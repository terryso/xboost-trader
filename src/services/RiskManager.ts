import type { IGridStrategy } from '../models/types/database.types';
import type { GridStrategyConfig } from './StrategyEngine';
import type { Logger } from './ServiceContainer';

export interface RiskAssessment {
  isApproved: boolean;
  riskLevel: RiskLevel;
  issues: RiskIssue[];
  recommendations: string[];
  maxAllowedAmount?: number;
}

export interface RiskIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'position_size' | 'price_range' | 'market_conditions' | 'balance' | 'configuration';
  message: string;
  suggestedAction: string;
}

export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export interface PositionLimits {
  maxPositionRatio: number;
  maxAbsolutePosition: number;
  maxDailyTrades: number;
  maxConcurrentStrategies: number;
}

export interface IRiskManager {
  validateStrategy(config: GridStrategyConfig): Promise<RiskAssessment>;
  assessCurrentRisk(strategyId: string): Promise<RiskLevel>;
  checkPositionLimits(strategyId: string, amount: number): Promise<boolean>;
  evaluateStopLoss(price: number, strategy: IGridStrategy): Promise<boolean>;
  emergencyStop(strategyId?: string): Promise<void>;
  updateRiskLimits(limits: Partial<PositionLimits>): Promise<void>;
  getRiskLimits(): PositionLimits;
  calculateMaxPositionSize(config: GridStrategyConfig, availableBalance: number): number;
}

export class RiskManager implements IRiskManager {
  private readonly logger: Logger;
  private riskLimits: PositionLimits;
  private readonly emergencyStopCallback?: (strategyId?: string) => Promise<void>;

  constructor(logger?: Logger, emergencyStopCallback?: (strategyId?: string) => Promise<void>) {
    this.logger = logger || console;
    this.emergencyStopCallback = emergencyStopCallback;

    // Default risk limits - should be configurable
    this.riskLimits = {
      maxPositionRatio: 0.8, // 80% of available balance
      maxAbsolutePosition: 50000, // $50,000 USD
      maxDailyTrades: 100,
      maxConcurrentStrategies: 10,
    };
  }

  async validateStrategy(config: GridStrategyConfig): Promise<RiskAssessment> {
    const requestId = `validate_strategy_${Date.now()}`;

    try {
      this.logger.info('Validating strategy risk', {
        requestId,
        config: this.sanitizeConfig(config),
      });

      const issues: RiskIssue[] = [];
      const recommendations: string[] = [];

      // Position size validation
      this.validatePositionSize(config, issues, recommendations);

      // Price range validation
      this.validatePriceRange(config, issues, recommendations);

      // Grid configuration validation
      this.validateGridConfiguration(config, issues, recommendations);

      // Stop loss validation
      this.validateStopLoss(config, issues, recommendations);

      // Network-specific validation
      this.validateNetworkRisks(config, issues, recommendations);

      // Calculate overall risk level
      const riskLevel = this.calculateRiskLevel(issues);

      // Determine approval status
      const isApproved = this.determineApproval(riskLevel, issues);

      // Calculate maximum allowed amount if applicable
      const maxAllowedAmount = this.calculateMaxAllowedAmount(config, issues);

      const assessment: RiskAssessment = {
        isApproved,
        riskLevel,
        issues,
        recommendations,
        maxAllowedAmount,
      };

      this.logger.info('Strategy risk validation completed', {
        requestId,
        assessment: {
          isApproved,
          riskLevel,
          issueCount: issues.length,
          recommendationCount: recommendations.length,
        },
      });

      return assessment;
    } catch (error) {
      this.logger.error('Failed to validate strategy risk', {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  async assessCurrentRisk(strategyId: string): Promise<RiskLevel> {
    const requestId = `assess_current_risk_${Date.now()}`;

    try {
      this.logger.debug('Assessing current strategy risk', { requestId, strategyId });

      // In a real implementation, this would fetch current strategy data,
      // analyze market conditions, position exposure, etc.

      // Mock implementation - would be replaced with actual risk calculation
      const mockRiskFactors = {
        positionExposure: 0.3, // 30% of max position
        marketVolatility: 0.15, // 15% volatility
        unrealizedLoss: 0.05, // 5% unrealized loss
        timeInPosition: 0.2, // 20% of max time threshold
      };

      const riskScore = this.calculateRiskScore(mockRiskFactors);
      const riskLevel = this.mapRiskScoreToLevel(riskScore);

      this.logger.debug('Current risk assessment completed', {
        requestId,
        strategyId,
        riskLevel,
        riskScore,
      });

      return riskLevel;
    } catch (error) {
      this.logger.error('Failed to assess current risk', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  async checkPositionLimits(strategyId: string, amount: number): Promise<boolean> {
    const requestId = `check_position_limits_${Date.now()}`;

    try {
      this.logger.debug('Checking position limits', { requestId, strategyId, amount });

      // Check against absolute position limit
      if (amount > this.riskLimits.maxAbsolutePosition) {
        this.logger.warn('Position exceeds absolute limit', {
          requestId,
          strategyId,
          amount,
          maxLimit: this.riskLimits.maxAbsolutePosition,
        });
        return false;
      }

      // In a real implementation, would check:
      // - Current portfolio exposure
      // - Available balance
      // - Existing positions
      // - Daily trade count
      // - Concurrent strategy count

      this.logger.debug('Position limits check passed', { requestId, strategyId, amount });
      return true;
    } catch (error) {
      this.logger.error('Failed to check position limits', {
        requestId,
        strategyId,
        amount,
        error: error.message,
      });
      return false;
    }
  }

  async evaluateStopLoss(price: number, strategy: IGridStrategy): Promise<boolean> {
    const requestId = `evaluate_stop_loss_${Date.now()}`;

    try {
      this.logger.debug('Evaluating stop loss', {
        requestId,
        strategyId: strategy.id,
        currentPrice: price,
        stopLoss: strategy.stopLoss,
      });

      if (!strategy.stopLoss) {
        this.logger.debug('No stop loss configured', { requestId, strategyId: strategy.id });
        return false;
      }

      const shouldTrigger = price <= strategy.stopLoss;

      if (shouldTrigger) {
        this.logger.warn('Stop loss triggered', {
          requestId,
          strategyId: strategy.id,
          currentPrice: price,
          stopLossPrice: strategy.stopLoss,
        });
      }

      return shouldTrigger;
    } catch (error) {
      this.logger.error('Failed to evaluate stop loss', {
        requestId,
        strategyId: strategy.id,
        error: error.message,
      });
      return false;
    }
  }

  async emergencyStop(strategyId?: string): Promise<void> {
    const requestId = `emergency_stop_${Date.now()}`;

    try {
      this.logger.error('Emergency stop triggered', { requestId, strategyId });

      if (this.emergencyStopCallback) {
        await this.emergencyStopCallback(strategyId);

        this.logger.info('Emergency stop executed', {
          requestId,
          strategyId: strategyId || 'all_strategies',
        });
      } else {
        this.logger.error('No emergency stop callback configured', { requestId });
        throw new Error('Emergency stop callback not configured');
      }
    } catch (error) {
      this.logger.error('Failed to execute emergency stop', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  async updateRiskLimits(limits: Partial<PositionLimits>): Promise<void> {
    const requestId = `update_risk_limits_${Date.now()}`;

    try {
      this.logger.info('Updating risk limits', { requestId, limits });

      // Validate new limits
      if (
        limits.maxPositionRatio !== undefined &&
        (limits.maxPositionRatio <= 0 || limits.maxPositionRatio > 1)
      ) {
        throw new Error('Max position ratio must be between 0 and 1');
      }

      if (limits.maxAbsolutePosition !== undefined && limits.maxAbsolutePosition <= 0) {
        throw new Error('Max absolute position must be greater than 0');
      }

      // Update limits
      this.riskLimits = { ...this.riskLimits, ...limits };

      this.logger.info('Risk limits updated successfully', {
        requestId,
        newLimits: this.riskLimits,
      });
    } catch (error) {
      this.logger.error('Failed to update risk limits', {
        requestId,
        limits,
        error: error.message,
      });
      throw error;
    }
  }

  getRiskLimits(): PositionLimits {
    return { ...this.riskLimits };
  }

  calculateMaxPositionSize(config: GridStrategyConfig, availableBalance: number): number {
    try {
      this.logger.debug('Calculating max position size', {
        pair: config.pair,
        availableBalance,
        maxPositionRatio: this.riskLimits.maxPositionRatio,
      });

      // Calculate based on position ratio
      const ratioBasedMax = availableBalance * this.riskLimits.maxPositionRatio;

      // Apply absolute limit
      const absoluteLimit = this.riskLimits.maxAbsolutePosition;

      // Take the minimum of both limits
      const maxSize = Math.min(ratioBasedMax, absoluteLimit);

      // Apply grid-specific adjustments
      const gridAdjustedMax = this.applyGridAdjustments(maxSize, config);

      this.logger.debug('Max position size calculated', {
        pair: config.pair,
        availableBalance,
        ratioBasedMax,
        absoluteLimit,
        finalMaxSize: gridAdjustedMax,
      });

      return gridAdjustedMax;
    } catch (error) {
      this.logger.error('Failed to calculate max position size', {
        config: this.sanitizeConfig(config),
        availableBalance,
        error: error.message,
      });
      throw error;
    }
  }

  private validatePositionSize(
    config: GridStrategyConfig,
    issues: RiskIssue[],
    recommendations: string[]
  ): void {
    // Check if base amount is reasonable
    if (config.baseAmount > this.riskLimits.maxAbsolutePosition) {
      issues.push({
        severity: 'critical',
        category: 'position_size',
        message: `Base amount exceeds maximum absolute position limit of $${this.riskLimits.maxAbsolutePosition}`,
        suggestedAction: `Reduce base amount to below $${this.riskLimits.maxAbsolutePosition}`,
      });
    }

    // Check position ratio
    if (config.maxPositionRatio > this.riskLimits.maxPositionRatio) {
      issues.push({
        severity: 'high',
        category: 'position_size',
        message: `Position ratio ${config.maxPositionRatio} exceeds recommended maximum of ${this.riskLimits.maxPositionRatio}`,
        suggestedAction: `Reduce max position ratio to ${this.riskLimits.maxPositionRatio} or lower`,
      });
    }

    // Calculate total potential exposure
    const totalExposure = config.baseAmount * config.gridCount;
    if (totalExposure > this.riskLimits.maxAbsolutePosition * 2) {
      issues.push({
        severity: 'medium',
        category: 'position_size',
        message: 'Total grid exposure is very high relative to limits',
        suggestedAction: 'Consider reducing grid count or base amount',
      });
      recommendations.push('Monitor position closely due to high total exposure');
    }
  }

  private validatePriceRange(
    config: GridStrategyConfig,
    issues: RiskIssue[],
    recommendations: string[]
  ): void {
    const priceRange = config.upperPrice - config.lowerPrice;
    const rangePercentage = priceRange / config.lowerPrice;

    // Check for extremely wide ranges
    if (rangePercentage > 1.0) {
      // 100% range
      issues.push({
        severity: 'high',
        category: 'price_range',
        message: 'Price range is extremely wide (>100% of lower price)',
        suggestedAction: 'Consider narrowing the price range for better capital efficiency',
      });
    }

    // Check for very narrow ranges
    if (rangePercentage < 0.05) {
      // 5% range
      issues.push({
        severity: 'medium',
        category: 'price_range',
        message: 'Price range is very narrow (<5% of lower price)',
        suggestedAction: 'Consider widening the range to capture more price movement',
      });
      recommendations.push('Narrow ranges may result in frequent rebalancing');
    }

    // Grid spacing validation
    const gridSpacing = priceRange / config.gridCount;
    const spacingPercentage = gridSpacing / config.lowerPrice;

    if (spacingPercentage < 0.001) {
      // 0.1% spacing
      issues.push({
        severity: 'medium',
        category: 'configuration',
        message: 'Grid spacing is very small, may result in excessive trading',
        suggestedAction: 'Consider reducing grid count or widening price range',
      });
    }
  }

  private validateGridConfiguration(
    config: GridStrategyConfig,
    issues: RiskIssue[],
    recommendations: string[]
  ): void {
    // High grid count validation
    if (config.gridCount > 50) {
      issues.push({
        severity: 'medium',
        category: 'configuration',
        message: 'Very high grid count may impact performance and increase gas costs',
        suggestedAction: 'Consider reducing grid count for better performance',
      });
    }

    // Low grid count for wide ranges
    const priceRange = config.upperPrice - config.lowerPrice;
    const rangePercentage = priceRange / config.lowerPrice;

    if (config.gridCount < 5 && rangePercentage > 0.2) {
      recommendations.push(
        'Consider increasing grid count for wide price ranges to improve capital efficiency'
      );
    }
  }

  private validateStopLoss(
    config: GridStrategyConfig,
    issues: RiskIssue[],
    recommendations: string[]
  ): void {
    if (config.stopLoss) {
      const stopLossDistance = config.lowerPrice - config.stopLoss;
      const distancePercentage = stopLossDistance / config.lowerPrice;

      if (distancePercentage < 0.05) {
        // Less than 5% below lower price
        issues.push({
          severity: 'medium',
          category: 'configuration',
          message: 'Stop loss is very close to lower price, may trigger prematurely',
          suggestedAction: 'Consider setting stop loss at least 5-10% below lower price',
        });
      }

      if (distancePercentage > 0.5) {
        // More than 50% below lower price
        issues.push({
          severity: 'low',
          category: 'configuration',
          message: 'Stop loss is very far from lower price, may not provide effective protection',
          suggestedAction: 'Consider tightening stop loss for better risk management',
        });
      }
    } else {
      recommendations.push('Consider setting a stop loss for additional risk protection');
    }
  }

  private validateNetworkRisks(
    config: GridStrategyConfig,
    issues: RiskIssue[],
    recommendations: string[]
  ): void {
    // Network-specific risk considerations
    const networkRisks: { [key: string]: string[] } = {
      ethereum: [
        'High gas fees may impact profitability',
        'Network congestion during high volatility',
      ],
      bnb: ['BSC network risks include centralization concerns'],
      linea: ['New network with limited track record', 'Lower liquidity compared to mainnet'],
      solana: ['Network instability history', 'Different transaction model'],
    };

    const risks = networkRisks[config.network] || [];

    risks.forEach(risk => {
      issues.push({
        severity: 'low',
        category: 'market_conditions',
        message: `Network risk: ${risk}`,
        suggestedAction: 'Monitor network conditions and be prepared to adjust strategy',
      });
    });

    if (config.network === 'ethereum' && config.baseAmount < 1000) {
      recommendations.push('Consider higher base amounts on Ethereum to offset gas costs');
    }
  }

  private calculateRiskLevel(issues: RiskIssue[]): RiskLevel {
    let riskScore = 0;

    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          riskScore += 10;
          break;
        case 'high':
          riskScore += 6;
          break;
        case 'medium':
          riskScore += 3;
          break;
        case 'low':
          riskScore += 1;
          break;
      }
    });

    return this.mapRiskScoreToLevel(riskScore);
  }

  private mapRiskScoreToLevel(riskScore: number): RiskLevel {
    if (riskScore >= 10) return 'very_high';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    if (riskScore >= 1) return 'low';
    return 'very_low';
  }

  private determineApproval(riskLevel: RiskLevel, issues: RiskIssue[]): boolean {
    // Don't approve if there are critical issues
    const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');
    if (hasCriticalIssues) return false;

    // Don't approve very high risk strategies
    if (riskLevel === 'very_high') return false;

    return true;
  }

  private calculateMaxAllowedAmount(
    config: GridStrategyConfig,
    issues: RiskIssue[]
  ): number | undefined {
    // If there are position size issues, calculate a safer amount
    const positionSizeIssues = issues.filter(issue => issue.category === 'position_size');

    if (positionSizeIssues.length > 0) {
      // Return a conservative amount based on limits
      return Math.min(
        this.riskLimits.maxAbsolutePosition * 0.5, // 50% of absolute limit
        config.baseAmount * 0.7 // 70% of requested amount
      );
    }

    return undefined;
  }

  private calculateRiskScore(factors: RiskFactors): number {
    interface RiskFactors {
      positionRisk: number;
      priceRisk: number;
      gridRisk: number;
      networkRisk: number;
      stopLossRisk: number;
    }
    // Weighted risk calculation
    return (
      (factors.positionExposure * 0.3 +
        factors.marketVolatility * 0.3 +
        factors.unrealizedLoss * 0.2 +
        factors.timeInPosition * 0.2) *
      10
    ); // Scale to 0-10
  }

  private applyGridAdjustments(maxSize: number, config: GridStrategyConfig): number {
    // Adjust based on grid complexity
    let adjustment = 1.0;

    // Reduce for high grid counts (more complex = more risk)
    if (config.gridCount > 20) {
      adjustment *= 0.8;
    }

    // Reduce for wide price ranges
    const priceRange = config.upperPrice - config.lowerPrice;
    const rangePercentage = priceRange / config.lowerPrice;

    if (rangePercentage > 0.5) {
      adjustment *= 0.9;
    }

    return maxSize * adjustment;
  }

  private sanitizeConfig(config: GridStrategyConfig): Partial<GridStrategyConfig> {
    return {
      pair: config.pair,
      network: config.network,
      gridType: config.gridType,
      upperPrice: config.upperPrice,
      lowerPrice: config.lowerPrice,
      gridCount: config.gridCount,
      baseAmount: config.baseAmount,
      maxPositionRatio: config.maxPositionRatio,
    };
  }
}
