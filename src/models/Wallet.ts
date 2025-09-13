export interface IWallet {
  address: string;
  encryptedPrivateKey: string;
  supportedNetworks: ('linea' | 'bnb' | 'ethereum' | 'solana')[];
  isDefault: boolean;
  createdAt: Date;
}

export interface IWalletRow {
  address: string;
  encrypted_private_key: string;
  supported_networks: string; // JSON string
  is_default: number; // SQLite boolean as integer
  created_at: string; // SQLite datetime as string
}
