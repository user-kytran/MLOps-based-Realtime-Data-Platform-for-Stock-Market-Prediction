import torch
import torch.nn as nn
import math

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=500):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class TemporalEmbedding(nn.Module):
    def __init__(self, d_model):
        super().__init__()
        self.day_embed = nn.Embedding(32, d_model)
        self.week_embed = nn.Embedding(7, d_model)
        self.month_embed = nn.Embedding(13, d_model)

    def forward(self, day, week, month):
        day = torch.clamp(day, 0, 31)
        week = torch.clamp(week, 0, 6)
        month = torch.clamp(month, 0, 12)
        return self.day_embed(day) + self.week_embed(week) + self.month_embed(month)

class ConvEmbedding(nn.Module):
    def __init__(self, in_channels, d_model, kernel_size=3):
        super().__init__()
        self.conv = nn.Conv1d(in_channels=in_channels, out_channels=d_model, 
                             kernel_size=kernel_size, padding=1)
        self.act = nn.ReLU()
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x):
        x = x.permute(0, 2, 1)
        x = self.conv(x)
        x = x.permute(0, 2, 1)
        return self.norm(self.act(x))

class StockTransformer(nn.Module):
    def __init__(self, num_encoder_features, num_decoder_features, 
                 d_model=512, nhead=8, num_layers=3, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        
        self.encoder_conv = ConvEmbedding(in_channels=num_encoder_features, d_model=d_model)
        self.encoder_temporal = TemporalEmbedding(d_model)
        self.encoder_pos = PositionalEncoding(d_model)
        
        encoder_layer = nn.TransformerEncoderLayer(d_model, nhead, 
                                                   dim_feedforward=2048, dropout=dropout)
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        self.decoder_conv = ConvEmbedding(in_channels=num_decoder_features, d_model=d_model)
        self.decoder_temporal = TemporalEmbedding(d_model)
        self.decoder_pos = PositionalEncoding(d_model)
        
        decoder_layer = nn.TransformerDecoderLayer(d_model, nhead, 
                                                   dim_feedforward=2048, dropout=dropout)
        self.decoder = nn.TransformerDecoder(decoder_layer, num_layers=num_layers)

        self.fc_out = nn.Linear(d_model, 1)

    def forward(self, encoder_input, decoder_input, day, week, month):
        src_embed = self.encoder_conv(encoder_input)
        src_embed = src_embed + self.encoder_temporal(day, week, month)
        src_embed = self.encoder_pos(src_embed)
        src_embed = src_embed.permute(1, 0, 2)
        memory = self.encoder(src_embed)

        tgt_embed = self.decoder_conv(decoder_input)
        tgt_embed = tgt_embed + self.decoder_temporal(day, week, month)
        tgt_embed = self.decoder_pos(tgt_embed)
        tgt_embed = tgt_embed.permute(1, 0, 2)
        
        out = self.decoder(tgt_embed, memory)
        out = out.permute(1, 0, 2)
        
        return self.fc_out(out[:, -1, :])

class StockLSTM(nn.Module):
    def __init__(self, num_encoder_features, num_decoder_features, 
                 hidden_size=512, num_layers=3, dropout=0.1):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.encoder_lstm = nn.LSTM(
            input_size=num_encoder_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        
        self.decoder_lstm = nn.LSTM(
            input_size=num_decoder_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        
        self.temporal = TemporalEmbedding(hidden_size)
        
        self.fc_out = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, 1)
        )

    def forward(self, encoder_input, decoder_input, day, week, month):
        enc_out, (enc_h, enc_c) = self.encoder_lstm(encoder_input)
        dec_out, (dec_h, dec_c) = self.decoder_lstm(decoder_input)
        
        temporal_embed = self.temporal(day[:, -1], week[:, -1], month[:, -1])
        
        enc_last = enc_out[:, -1, :] + temporal_embed
        dec_last = dec_out[:, -1, :] + temporal_embed
        combined = torch.cat([enc_last, dec_last], dim=1)
        
        return self.fc_out(combined)
