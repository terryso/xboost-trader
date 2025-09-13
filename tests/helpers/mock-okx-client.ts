
import { EventEmitter } from 'events';

// This is a simplified mock of the OKX client for testing purposes.
// It simulates the websocket connection and API calls.

export class MockOkxClient extends EventEmitter {
  private balances: Record<string, number> = {};
  private openOrders: any[] = [];

  constructor(apiKey: string, apiSecret: string, passphrase: string) {
    super();
    if (!apiKey || !apiSecret || !passphrase) {
      throw new Error('API credentials are required');
    }
  }

  // Simulate connecting to the websocket
  connect() {
    this.emit('open');
  }

  // Simulate disconnecting from the websocket
  disconnect() {
    this.emit('close');
  }

  // Simulate a price update for a given instrument
  simulatePriceUpdate(instrumentId: string, price: number) {
    this.emit('message', JSON.stringify({
      arg: {
        channel: 'tickers',
        instId: instrumentId,
      },
      data: [
        {
          last: price.toString(),
        },
      ],
    }));
  }

  // Simulate a trade execution
  async placeOrder(order: any) {
    const { instId, side, ordType, sz, px } = order;
    const orderId = Math.random().toString(36).substring(2, 15);

    const newOrder = {
      instId,
      ordId: orderId,
      side,
      ordType,
      sz,
      px,
      state: 'live',
      cTime: Date.now(),
    };

    this.openOrders.push(newOrder);

    // Simulate immediate execution for market orders
    if (ordType === 'market') {
      newOrder.state = 'filled';
      this.updateBalances(instId, side, sz, px);
    }

    return { orderId };
  }

  // Simulate canceling an order
  async cancelOrder(orderId: string) {
    const order = this.openOrders.find(o => o.ordId === orderId);
    if (order) {
      order.state = 'canceled';
      this.openOrders = this.openOrders.filter(o => o.ordId !== orderId);
      return { orderId };
    }
    throw new Error('Order not found');
  }

  // Helper to update balances after a simulated trade
  private updateBalances(instId: string, side: 'buy' | 'sell', size: number, price: number) {
    const [base, quote] = instId.split('-');
    if (side === 'buy') {
      this.balances[base] = (this.balances[base] || 0) + size;
      this.balances[quote] = (this.balances[quote] || 0) - (size * price);
    } else {
      this.balances[base] = (this.balances[base] || 0) - size;
      this.balances[quote] = (this.balances[quote] || 0) + (size * price);
    }
  }

  // Method to set initial balances for testing
  setBalances(balances: Record<string, number>) {
    this.balances = balances;
  }

  // Method to get current balances
  getBalances() {
    return this.balances;
  }

  // Method to get open orders
  getOpenOrders() {
    return this.openOrders;
  }
}
