import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { businessProfile } from '@/config/public';

type Props = {
  onLogin: (username: string, password: string) => Promise<any>;
};

export default function Login({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await onLogin(values.username, values.password);
      message.success('登录成功');
    } catch (err: any) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-badge">订货 配货 结算</div>
          <h1 className="auth-title">{businessProfile.name}</h1>
          <p className="auth-subtitle">
            登录后直接进工作台。
            手机上看更像原生 App，后台页也会保持现在的业务流程。
          </p>

          <Form
            onFinish={handleSubmit}
            size="large"
            style={{ marginTop: 28 }}
          >
            <Form.Item name="username" rules={[{ required: true, message: '请输入手机号' }]}>
              <Input prefix={<UserOutlined />} placeholder="手机号" inputMode="numeric" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
