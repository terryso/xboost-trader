import { EventEmitter } from 'events';
import type { IPriceHistory } from '../models/types/database.types';
import type { DatabaseConnection } from '../utils/DatabaseConnection';
import type { Logger } from './ServiceContainer';

export interface PriceData {
  pair: string;
  price: number;
  volume24h: number;
  timestamp: Date;
}

export interface PriceCallback {
  (priceData: PriceData): void;
}

export interface PriceAlert {
  id: string;
  pair: string;
  condition: 'above' | 'below';
  targetPrice: number;
  callback: (priceData: PriceData) => void;
  isActive: boolean;
}

export interface IPriceMonitor {
  startMonitoring(pairs: string[]): Promise<void>;
  stopMonitoring(pair?: string): Promise<void>;
  getCurrentPrice(pair: string): Promise<number>;
  getPriceHistory(pair: string, timeframe: string, limit?: number): Promise<IPriceHistory[]>;
  subscribeToPrice(pair: string, callback: PriceCallback): string;
  unsubscribeFromPrice(subscriptionId: string): void;
  addPriceAlert(
    pair: string,
    condition: 'above' | 'below',
    targetPrice: number,
    callback: PriceCallback
  ): string;
  removePriceAlert(alertId: string): void;
  isMonitoring(pair: string): boolean;
  getMonitoredPairs(): string[];
}

export class PriceMonitor extends EventEmitter implements IPriceMonitor {
  private readonly db: DatabaseConnection;
  private readonly logger: Logger;
  private readonly monitoredPairs: Set<string> = new Set();
  private readonly priceCache: Map<string, PriceData> = new Map();
  private readonly subscriptions: Map<string, { pair: string; callback: PriceCallback }> =
    new Map();
  private readonly alerts: Map<string, PriceAlert> = new Map();
  private readonly pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly defaultPollingInterval: number = 5000; // 5 seconds

  constructor(db: DatabaseConnection, logger?: Logger) {
    super();
    this.db = db;
    this.logger = logger || console;
  }

  async startMonitoring(pairs: string[]): Promise<void> {
    const requestId = `start_monitoring_${Date.now()}`;

    try {
      this.logger.info('Starting price monitoring', { requestId, pairs });

      for (const pair of pairs) {
        if (this.monitoredPairs.has(pair)) {
          this.logger.warn('Already monitoring pair', { requestId, pair });
          continue;
        }

        this.monitoredPairs.add(pair);
        await this.startPairMonitoring(pair);

        this.logger.debug('Started monitoring pair', { requestId, pair });
      }

      this.logger.info('Price monitoring started for all pairs', {
        requestId,
        totalPairs: this.monitoredPairs.size,
      });

      this.emit('monitoringStarted', { pairs, totalPairs: this.monitoredPairs.size });
    } catch (error) {
      this.logger.error('Failed to start price monitoring', {
        requestId,
        pairs,
        error: error.message,
      });
      throw error;
    }
  }

  async stopMonitoring(pair?: string): Promise<void> {
    const requestId = `stop_monitoring_${Date.now()}`;

    try {
      if (pair) {
        this.logger.info('Stopping monitoring for specific pair', { requestId, pair });

        if (!this.monitoredPairs.has(pair)) {
          this.logger.warn('Pair not being monitored', { requestId, pair });
          return;
        }

        await this.stopPairMonitoring(pair);
        this.logger.info('Stopped monitoring pair', { requestId, pair });
      } else {
        this.logger.info('Stopping all price monitoring', { requestId });

        const pairs = Array.from(this.monitoredPairs);
        for (const monitoredPair of pairs) {
          await this.stopPairMonitoring(monitoredPair);
        }

        this.logger.info('Stopped all price monitoring', { requestId, stoppedPairs: pairs.length });
      }

      this.emit('monitoringStopped', { pair, totalPairs: this.monitoredPairs.size });
    } catch (error) {
      this.logger.error('Failed to stop price monitoring', {
        requestId,
        pair,
        error: error.message,
      });
      throw error;
    }
  }

  async getCurrentPrice(pair: string): Promise<number> {
    const requestId = `get_current_price_${Date.now()}`;

    try {
      this.logger.debug('Getting current price', { requestId, pair });

      // Check cache first
      const cachedPrice = this.priceCache.get(pair);
      if (cachedPrice && this.isCacheValid(cachedPrice.timestamp)) {
        this.logger.debug('Returning cached price', {
          requestId,
          pair,
          price: cachedPrice.price,
          age: Date.now() - cachedPrice.timestamp.getTime(),
        });
        return cachedPrice.price;
      }

      // Fetch fresh price (in a real implementation, this would call external API)
      const price = await this.fetchPriceFromAPI(pair);

      // Update cache
      const priceData: PriceData = {
        pair,
        price,
        volume24h: 0, // Would be fetched from API
        timestamp: new Date(),
      };

      this.priceCache.set(pair, priceData);

      this.logger.debug('Fetched current price', { requestId, pair, price });
      return price;
    } catch (error) {
      this.logger.error('Failed to get current price', {
        requestId,
        pair,
        error: error.message,
      });
      throw error;
    }
  }

  async getPriceHistory(
    pair: string,
    timeframe: string,
    limit: number = 100
  ): Promise<IPriceHistory[]> {
    const requestId = `get_price_history_${Date.now()}`;

    try {
      this.logger.debug('Getting price history', { requestId, pair, timeframe, limit });

      // Convert timeframe to SQL interval
      const sqlInterval = this.convertTimeframeToSQL(timeframe);

      const sql = `
        SELECT * FROM price_history 
        WHERE pair = ? 
          AND timestamp >= datetime('now', '-${sqlInterval}')
        ORDER BY timestamp DESC 
        LIMIT ?
      `;

      const rows = await this.db.query<IPriceHistory[]>(sql, [pair, limit]);

      const priceHistory: IPriceHistory[] = rows.map(row => ({
        id: row.id,
        pair: row.pair,
        price: row.price,
        volume24h: row.volume_24h,
        timestamp: new Date(row.timestamp),
      }));

      this.logger.debug('Retrieved price history', {
        requestId,
        pair,
        timeframe,
        recordCount: priceHistory.length,
      });

      return priceHistory;
    } catch (error) {
      this.logger.error('Failed to get price history', {
        requestId,
        pair,
        timeframe,
        error: error.message,
      });
      throw error;
    }
  }

  subscribeToPrice(pair: string, callback: PriceCallback): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestId = `subscribe_price_${Date.now()}`;

    this.logger.debug('Creating price subscription', { requestId, pair, subscriptionId });

    this.subscriptions.set(subscriptionId, { pair, callback });

    // If not already monitoring, start monitoring this pair
    if (!this.monitoredPairs.has(pair)) {
      this.startMonitoring([pair]).catch(error => {
        this.logger.error('Failed to start monitoring for subscription', {
          requestId,
          pair,
          subscriptionId,
          error: error.message,
        });
      });
    }

    this.logger.debug('Price subscription created', { requestId, pair, subscriptionId });
    return subscriptionId;
  }

  unsubscribeFromPrice(subscriptionId: string): void {
    const requestId = `unsubscribe_price_${Date.now()}`;

    this.logger.debug('Removing price subscription', { requestId, subscriptionId });

    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);

      // Check if any other subscriptions exist for this pair
      const hasOtherSubscriptions = Array.from(this.subscriptions.values()).some(
        sub => sub.pair === subscription.pair
      );

      if (!hasOtherSubscriptions) {
        // Stop monitoring if no more subscriptions for this pair
        this.stopMonitoring(subscription.pair).catch(error => {
          this.logger.error('Failed to stop monitoring after unsubscribe', {
            requestId,
            pair: subscription.pair,
            error: error.message,
          });
        });
      }

      this.logger.debug('Price subscription removed', { requestId, subscriptionId });
    } else {
      this.logger.warn('Subscription not found', { requestId, subscriptionId });
    }
  }

  addPriceAlert(
    pair: string,
    condition: 'above' | 'below',
    targetPrice: number,
    callback: PriceCallback
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestId = `add_price_alert_${Date.now()}`;

    this.logger.info('Adding price alert', {
      requestId,
      pair,
      condition,
      targetPrice,
      alertId,
    });

    const alert: PriceAlert = {
      id: alertId,
      pair,
      condition,
      targetPrice,
      callback,
      isActive: true,
    };

    this.alerts.set(alertId, alert);

    // Start monitoring the pair if not already monitoring
    if (!this.monitoredPairs.has(pair)) {
      this.startMonitoring([pair]).catch(error => {
        this.logger.error('Failed to start monitoring for alert', {
          requestId,
          pair,
          alertId,
          error: error.message,
        });
      });
    }

    this.logger.info('Price alert added', { requestId, pair, alertId });
    return alertId;
  }

  removePriceAlert(alertId: string): void {
    const requestId = `remove_price_alert_${Date.now()}`;

    this.logger.info('Removing price alert', { requestId, alertId });

    const alert = this.alerts.get(alertId);
    if (alert) {
      this.alerts.delete(alertId);
      this.logger.info('Price alert removed', { requestId, alertId, pair: alert.pair });
    } else {
      this.logger.warn('Price alert not found', { requestId, alertId });
    }
  }

  isMonitoring(pair: string): boolean {
    return this.monitoredPairs.has(pair);
  }

  getMonitoredPairs(): string[] {
    return Array.from(this.monitoredPairs);
  }

  private async startPairMonitoring(pair: string): Promise<void> {
    // Clear existing interval if any
    const existingInterval = this.pollingIntervals.get(pair);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new polling interval
    const interval = setInterval(async () => {
      try {
        const price = await this.fetchPriceFromAPI(pair);
        const priceData: PriceData = {
          pair,
          price,
          volume24h: 0, // Would be fetched from API
          timestamp: new Date(),
        };

        // Update cache
        this.priceCache.set(pair, priceData);

        // Store in database
        await this.storePriceData(priceData);

        // Emit price update event
        this.emit('priceUpdate', priceData);

        // Notify subscriptions
        this.notifySubscriptions(priceData);

        // Check alerts
        this.checkAlerts(priceData);
      } catch (error) {
        this.logger.error('Error in price polling', {
          pair,
          error: error.message,
        });
        this.emit('priceError', { pair, error: error.message });
      }
    }, this.defaultPollingInterval);

    this.pollingIntervals.set(pair, interval);
  }

  private async stopPairMonitoring(pair: string): Promise<void> {
    const interval = this.pollingIntervals.get(pair);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(pair);
    }

    this.monitoredPairs.delete(pair);
    this.priceCache.delete(pair);

    // Remove subscriptions for this pair
    for (const [subId, sub] of this.subscriptions.entries()) {
      if (sub.pair === pair) {
        this.subscriptions.delete(subId);
      }
    }

    // Remove alerts for this pair
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.pair === pair) {
        this.alerts.delete(alertId);
      }
    }
  }

  private async fetchPriceFromAPI(pair: string): Promise<number> {
    // Mock implementation - in real implementation, this would call external API
    // For now, return a mock price with some randomization
    const basePrice = pair === 'ETH/USDT' ? 1800 : 1;
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    return basePrice * (1 + variation);
  }

  private async storePriceData(priceData: PriceData): Promise<void> {
    try {
      const sql = `
        INSERT INTO price_history (pair, price, volume_24h, timestamp)
        VALUES (?, ?, ?, ?)
      `;

      await this.db.run(sql, [
        priceData.pair,
        priceData.price,
        priceData.volume24h,
        priceData.timestamp.toISOString(),
      ]);
    } catch (error) {
      this.logger.error('Failed to store price data', {
        priceData,
        error: error.message,
      });
    }
  }

  private notifySubscriptions(priceData: PriceData): void {
    for (const [subId, subscription] of this.subscriptions.entries()) {
      if (subscription.pair === priceData.pair) {
        try {
          subscription.callback(priceData);
        } catch (error) {
          this.logger.error('Error in subscription callback', {
            subscriptionId: subId,
            pair: priceData.pair,
            error: error.message,
          });
        }
      }
    }
  }

  private checkAlerts(priceData: PriceData): void {
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.pair === priceData.pair && alert.isActive) {
        let shouldTrigger = false;

        if (alert.condition === 'above' && priceData.price > alert.targetPrice) {
          shouldTrigger = true;
        } else if (alert.condition === 'below' && priceData.price < alert.targetPrice) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          try {
            alert.callback(priceData);
            // Deactivate alert after triggering
            alert.isActive = false;

            this.logger.info('Price alert triggered', {
              alertId,
              pair: alert.pair,
              condition: alert.condition,
              targetPrice: alert.targetPrice,
              currentPrice: priceData.price,
            });

            this.emit('alertTriggered', { alert, priceData });
          } catch (error) {
            this.logger.error('Error in alert callback', {
              alertId,
              pair: alert.pair,
              error: error.message,
            });
          }
        }
      }
    }
  }

  private isCacheValid(timestamp: Date): boolean {
    const maxAge = 10000; // 10 seconds
    return Date.now() - timestamp.getTime() < maxAge;
  }

  private convertTimeframeToSQL(timeframe: string): string {
    const timeframeMap: { [key: string]: string } = {
      '1h': '1 hour',
      '4h': '4 hours',
      '1d': '1 day',
      '7d': '7 days',
      '30d': '30 days',
      '1m': '1 minute',
      '5m': '5 minutes',
      '15m': '15 minutes',
    };

    return timeframeMap[timeframe] || '1 day';
  }
}
