import { BaseRepository } from './BaseRepository';
import type { IWallet, WalletRow } from '../models/types/database.types';
import type { DatabaseConnection } from '../utils/DatabaseConnection';

export class WalletRepository extends BaseRepository<IWallet, WalletRow> {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  get tableName(): string {
    return 'wallets';
  }

  mapRowToEntity(row: WalletRow): IWallet {
    return {
      address: row.address,
      encryptedPrivateKey: row.encrypted_private_key,
      supportedNetworks: JSON.parse(row.supported_networks) as (
        | 'linea'
        | 'bnb'
        | 'ethereum'
        | 'solana'
      )[],
      isDefault: row.is_default === 1,
      createdAt: new Date(row.created_at),
    };
  }

  mapEntityToRow(entity: IWallet): Partial<WalletRow> {
    return {
      address: entity.address,
      encrypted_private_key: entity.encryptedPrivateKey,
      supported_networks: JSON.stringify(entity.supportedNetworks),
      is_default: entity.isDefault ? 1 : 0,
      created_at: entity.createdAt.toISOString(),
    };
  }

  protected getInsertFields(): string[] {
    return ['address', 'encrypted_private_key', 'supported_networks', 'is_default', 'created_at'];
  }

  protected getUpdateFields(): string[] {
    return ['encrypted_private_key', 'supported_networks', 'is_default'];
  }

  // Override methods to use 'address' instead of 'id' as primary key

  async findById(address: string): Promise<IWallet | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE address = ?`;
      const row = await this.db.get<WalletRow>(sql, [address]);

      if (!row) {
        return null;
      }

      return this.mapRowToEntity(row);
    } catch (error) {
      throw new Error(`Failed to find wallet by address ${address}: ${error.message}`);
    }
  }

  async delete(address: string): Promise<void> {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE address = ?`;
      const result = await this.db.run(sql, [address]);

      if (!result || result.changes === 0) {
        throw new Error(`No wallet found with address ${address}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete wallet with address ${address}: ${error.message}`);
    }
  }

  async exists(address: string): Promise<boolean> {
    try {
      const sql = `SELECT 1 FROM ${this.tableName} WHERE address = ? LIMIT 1`;
      const result = await this.db.get(sql, [address]);
      return result !== null;
    } catch (error) {
      throw new Error(`Failed to check existence of wallet: ${error.message}`);
    }
  }

  // Override save method to handle address-based upsert
  async save(entity: IWallet): Promise<void> {
    try {
      await this.db.transaction(async () => {
        const existing = await this.findById(entity.address);
        if (existing) {
          await this.updateByAddress(entity);
        } else {
          await this.insert(entity);
        }
      });
    } catch (error) {
      throw new Error(`Failed to save wallet: ${error.message}`);
    }
  }

  private async updateByAddress(entity: IWallet): Promise<void> {
    try {
      const row = this.mapEntityToRow(entity);
      const fields = this.getUpdateFields();
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => row[field]);

      // Add address to the end for WHERE clause
      values.push(entity.address);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE address = ?`;
      const result = await this.db.run(sql, values);

      if (!result || result.changes === 0) {
        throw new Error(`No wallet found with address ${entity.address}`);
      }
    } catch (error) {
      throw new Error(`Failed to update wallet: ${error.message}`);
    }
  }

  // Business-specific methods for wallet management

  /**
   * Find the default wallet
   */
  async findDefaultWallet(): Promise<IWallet | null> {
    return this.findOneByCondition('is_default = 1', []);
  }

  /**
   * Set a wallet as default (and unset all others)
   */
  async setAsDefault(address: string): Promise<void> {
    try {
      await this.db.transaction(async () => {
        // Unset all default wallets
        await this.db.run('UPDATE wallets SET is_default = 0');

        // Set the specified wallet as default
        const result = await this.db.run('UPDATE wallets SET is_default = 1 WHERE address = ?', [
          address,
        ]);

        if (!result || result.changes === 0) {
          throw new Error(`No wallet found with address ${address}`);
        }
      });
    } catch (error) {
      throw new Error(`Failed to set wallet as default: ${error.message}`);
    }
  }

  /**
   * Find wallets by supported network
   */
  async findByNetwork(network: 'linea' | 'bnb' | 'ethereum' | 'solana'): Promise<IWallet[]> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE supported_networks LIKE ?`;
      const rows = await this.db.query<WalletRow>(sql, [`%"${network}"%`]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to find wallets by network: ${error.message}`);
    }
  }

  /**
   * Get wallet count
   */
  async getWalletCount(): Promise<number> {
    try {
      const result = await this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM wallets');
      return result?.count || 0;
    } catch (error) {
      throw new Error(`Failed to get wallet count: ${error.message}`);
    }
  }

  /**
   * Check if address is valid format (basic validation)
   */
  isValidAddress(address: string): boolean {
    // Basic Ethereum-style address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
