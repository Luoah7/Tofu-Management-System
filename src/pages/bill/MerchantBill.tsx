import React, { useEffect, useState } from 'react';
import { Spin, Tag } from 'antd';
import { Phone, MapPin, ReceiptText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { businessProfile } from '@/config/public';
import { formatMoney } from '@/utils/format';

type BillData = {
  merchant: {
    id: string; name: string; type: string; address: string;
    phone: string; settlementDay: string; basketCount: number;
  };
  pendingAmount: number;
  settledAmount: number;
  deliveryHistory: Array<{
    id: string; date: string; totalAmount: number;
    items: Array<{ name: string; specLabel: string; weight: number; unitPrice: number; subtotal: number }>;
  }>;
  settlements: Array<{
    id: string; periodStart: string; periodEnd: string;
    totalAmount: number; paidAmount: number; payStatus: string;
  }>;
};

export default function MerchantBill() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const [data, setData] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!merchantId) return;
    fetch(`/api/public/merchants/${merchantId}/bill`)
      .then(res => {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [merchantId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error || !data) return (
    <div style={{ maxWidth: 430, margin: '0 auto', textAlign: 'center', padding: 80, color: '#999' }}>
      <ReceiptText size={48} />
      <p style={{ marginTop: 12 }}>{error || '未找到商户信息'}</p>
    </div>
  );

  const { merchant, pendingAmount, settledAmount, deliveryHistory } = data;

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#fff', minHeight: '100vh' }}>
      {/* 头部 */}
      <div style={{ background: 'linear-gradient(135deg, #1d6b49, #2f9a67)', padding: '24px 20px', color: '#fff' }}>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>{businessProfile.name}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{merchant.name}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>结算日：{merchant.settlementDay || '—'}</div>
      </div>

      {/* 金额概览 */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, background: '#f6ffed', borderRadius: 8, padding: '12px 16px', border: '1px solid #b7eb8f' }}>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>待结算金额</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1d6b49' }}>{formatMoney(pendingAmount)}</div>
          </div>
          <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>已结算金额</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(0,0,0,0.88)' }}>{formatMoney(settledAmount)}</div>
          </div>
        </div>

        {/* 配货记录 */}
        {deliveryHistory.length > 0 ? (
          deliveryHistory.map(record => (
            <div key={record.id} style={{
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8, marginBottom: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{record.date}</span>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginLeft: 8 }}>
                    {record.items.map(i => i.name).join(' / ')}
                  </span>
                </div>
                <span style={{ fontWeight: 600, color: '#1d6b49' }}>{formatMoney(record.totalAmount)}</span>
              </div>
              {record.items.length > 0 && (
                <div style={{ padding: '0 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 500, color: 'rgba(0,0,0,0.45)' }}>商品</th>
                        <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: 'rgba(0,0,0,0.45)' }}>重量</th>
                        <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: 'rgba(0,0,0,0.45)' }}>单价</th>
                        <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: 'rgba(0,0,0,0.45)' }}>小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '8px 0' }}>
                            <div>{item.name}</div>
                            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>{item.specLabel}</div>
                          </td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{item.weight}斤</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{formatMoney(item.unitPrice)}/斤</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: '8px 16px 12px', fontSize: 12, color: 'rgba(0,0,0,0.25)', textAlign: 'right' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', background: '#fffbe6', border: '1px solid #ffe58f',
                  borderRadius: 4, color: '#faad14', fontSize: 11,
                }}>
                  待结算
                </span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(0,0,0,0.25)' }}>
            <ReceiptText size={48} />
            <p style={{ marginTop: 8, fontSize: 14 }}>暂无配货记录</p>
          </div>
        )}

        {/* 持有筐子 */}
        {merchant.basketCount > 0 && (
          <div style={{
            background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8,
            padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#d46b08',
          }}>
            当前持有 {merchant.basketCount} 个筐子待归还
          </div>
        )}
      </div>

      {/* 联系方式 */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          <Phone size={14} />
          联系方式
        </div>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)', lineHeight: 1.8 }}>
          <div>工厂：{businessProfile.name}</div>
          {businessProfile.phone ? <div>电话：{businessProfile.phone}</div> : null}
          {businessProfile.address ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
              <MapPin size={14} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>地址：{businessProfile.address}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
