import torch
import torch.nn as nn
import math
import numpy as np
import pandas as pd
from torch.utils.data import Dataset
from sklearn.preprocessing import MinMaxScaler

class StockDataset(Dataset):
    def __init__(self, df: pd.DataFrame, window_size: int = 5):
        """
        Dataset cho mô hình Transformer Encoder-Decoder.
        df: DataFrame có đầy đủ cột features, close price, alphas, v.v.
        window_size: độ dài cửa sổ trượt (mặc định 5 ngày)
        """
        self.df = df.copy()
        self.window_size = window_size

        # --- CHỌN CÁC CỘT LÀM INPUT ---
        # Encoder input: 5 alphas
        self.encoder_features = ['Alpha1', 'Alpha2', 'Alpha3', 'Alpha4', 'Alpha5']
        
        # Clean NaN and Inf values
        self.df[self.encoder_features] = self.df[self.encoder_features].replace([np.inf, -np.inf], np.nan)
        self.df = self.df.dropna(subset=self.encoder_features + ['close'])
        
        # Decoder input: close price
        self.decoder_features = ['close']
        
        # --- SCALING ---
        self.scaler_encoder = MinMaxScaler()
        self.scaler_close = MinMaxScaler()  # Dùng chung cho decoder input và target
        
        # Lưu giá trị gốc trước khi scale
        original_close = self.df[['close']].values
        
        # Fit và transform encoder features (5 alphas)
        encoder_data = self.df[self.encoder_features].values
        self.scaler_encoder.fit(encoder_data)
        self.df[self.encoder_features] = self.scaler_encoder.transform(encoder_data)
        
        # Fit và transform close price (dùng chung cho decoder và target)
        self.scaler_close.fit(original_close)
        self.df['close_scaled'] = self.scaler_close.transform(original_close).flatten()
        
        
        # Temporal features: extract từ trade_date
        self.df['trade_date'] = pd.to_datetime(self.df['trade_date'])
        self.df['day'] = self.df['trade_date'].dt.day - 1  # 0-30
        self.df['week'] = self.df['trade_date'].dt.dayofweek  # 0-6
        self.df['month'] = self.df['trade_date'].dt.month - 1  # 0-11
        self.temporal_features = ['day', 'week', 'month']

        self.X_enc, self.X_dec, self.y, self.temporal = self._create_sequences()

    def _create_sequences(self):
        """
        Tạo sliding window cho Encoder, Decoder và Target
        """
        X_enc, X_dec, y, temporal = [], [], [], []
        total_len = len(self.df)

        for i in range(total_len - self.window_size):
            # encoder: 5 alphas (đã scaled)
            enc_window = self.df[self.encoder_features].iloc[i:i+self.window_size].values
            
            # decoder: close price (đã scaled)
            dec_window = self.df[['close_scaled']].iloc[i:i+self.window_size].values
            
            # temporal features
            time_window = self.df[self.temporal_features].iloc[i:i+self.window_size].values
            
            # target: giá đóng cửa ngày tiếp theo (đã scaled)
            target = self.df['close_scaled'].iloc[i + self.window_size]

            X_enc.append(enc_window)
            X_dec.append(dec_window)
            temporal.append(time_window)
            y.append(target)

        return np.array(X_enc), np.array(X_dec), np.array(y), np.array(temporal)

    def __len__(self):
        return len(self.y)

    def __getitem__(self, idx):
        enc = torch.tensor(self.X_enc[idx], dtype=torch.float32)      # (window, 5)
        dec = torch.tensor(self.X_dec[idx], dtype=torch.float32)      # (window, 1)
        target = torch.tensor(self.y[idx], dtype=torch.float32)       # scalar
        
        # Temporal features: (window, 3) -> tách ra thành 3 tensors
        day = torch.tensor(self.temporal[idx][:, 0], dtype=torch.long)
        week = torch.tensor(self.temporal[idx][:, 1], dtype=torch.long)
        month = torch.tensor(self.temporal[idx][:, 2], dtype=torch.long)
        
        return enc, dec, target, day, week, month