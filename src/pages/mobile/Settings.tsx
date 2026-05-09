import React, { useEffect, useState } from 'react';
import { Button, InputNumber, Select, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings as SettingsIcon } from 'lucide-react';
import { api } from '@/api/client';
import { SectionHeading } from '@/components/mobile/shared';

type TaskItemSettings = {
  basketWeightJin: number;
};

type WeightUnit = '斤' | '公斤';

export default function MobileSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [basketWeightJin, setBasketWeightJin] = useState(12);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('斤');

  const displayWeight = weightUnit === '公斤'
    ? Number((basketWeightJin / 2).toFixed(1))
    : basketWeightJin;

  useEffect(() => {
    api.get<TaskItemSettings>('/settings/task-items')
      .then((settings) => setBasketWeightJin(settings.basketWeightJin))
      .catch((err: any) => message.error(err.message || '设置加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = await api.put<TaskItemSettings>('/settings/task-items', { basketWeightJin });
      setBasketWeightJin(settings.basketWeightJin);
      message.success('设置已保存');
    } catch (err: any) {
      message.error(err.message || '设置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleWeightChange = (value: number | null) => {
    const next = Number(value || 0);
    setBasketWeightJin(weightUnit === '公斤' ? Number((next * 2).toFixed(1)) : next);
  };

  if (loading) {
    return (
      <div className="mobile-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <button type="button" className="mobile-back-button" onClick={() => navigate('/mobile/manage')}>
          <ChevronLeft size={18} />
          返回
        </button>
        <div className="mobile-hero__eyebrow">全局设置</div>
        <div className="mobile-hero__title">参数配置</div>
      </section>

      <SectionHeading title="任务换算" />

      <div className="mobile-surface mobile-rise">
        <div className="mobile-field-card__label">一筐默认重量</div>
        <div className="mobile-setting-measure">
          <InputNumber
            min={0.5}
            step={0.5}
            value={displayWeight}
            onChange={handleWeightChange}
            size="large"
          />
          <Select
            value={weightUnit}
            onChange={setWeightUnit}
            options={[
              { value: '斤', label: '斤' },
              { value: '公斤', label: '公斤' },
            ]}
            size="large"
          />
        </div>
        <div className="mobile-setting-hint">
          当前等于 {basketWeightJin.toFixed(1)} 斤，{(basketWeightJin / 2).toFixed(1)} 公斤
        </div>
        <div className="mobile-entry-total">
          <span>生效范围</span>
          <strong>新建任务和未复秤任务</strong>
        </div>
      </div>

      <Button
        type="primary"
        className="mobile-primary-button"
        icon={<SettingsIcon size={16} />}
        loading={saving}
        onClick={handleSave}
        block
        size="large"
      >
        保存设置
      </Button>
    </div>
  );
}
