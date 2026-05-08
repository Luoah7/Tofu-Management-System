# 阿里云 + Cloudflare 部署说明

这套项目最稳的部署方式是：

阿里云 ECS 负责跑应用和数据库，Nginx 负责 443 入口和反向代理，Node 进程只监听本机 `3000` 端口。Cloudflare 如果不是 China Network 企业版，建议只做 DNS 托管，不建议开启橙云代理。

## 推荐拓扑

浏览器 -> 域名 DNS -> 阿里云 ECS -> Nginx 443 -> Node 3000 -> SQLite

## 服务器目录建议

```bash
/srv/tofu/current
/srv/tofu/shared/data
/srv/tofu/shared/.env
```

把代码放到 `/srv/tofu/current`，把数据库和 `.env` 放到 `shared` 目录，后面更新代码时不要覆盖数据。

## 首次部署

```bash
sudo apt update
sudo apt install -y nginx git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

```bash
sudo mkdir -p /srv/tofu/current /srv/tofu/shared/data /etc/ssl/tofu
sudo chown -R $USER:$USER /srv/tofu
git clone https://github.com/Luoah7/Tofu-Management-System.git /srv/tofu/current
cd /srv/tofu/current
npm install
cp .env.example /srv/tofu/shared/.env
```

`.env` 至少要填这些值：

```bash
PORT=3000
DB_PATH=/srv/tofu/shared/data/doufu.db
JWT_SECRET=请换成一段足够长的随机字符串
ADMIN_USERNAME=你的管理员账号
ADMIN_PASSWORD=你的管理员密码
ADMIN_DISPLAY_NAME=管理员
ADMIN_ROLE=admin
VITE_BUSINESS_NAME=你的品牌名
VITE_BUSINESS_PHONE=对外电话
VITE_BUSINESS_ADDRESS=对外地址
```

然后把 `.env` 链接到代码目录：

```bash
ln -sf /srv/tofu/shared/.env /srv/tofu/current/.env
```

构建并初始化数据：

```bash
cd /srv/tofu/current
npm run seed
npm run build
```

## systemd

把 `deploy/tofu.service` 复制到 `/etc/systemd/system/tofu.service`，然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tofu
sudo systemctl start tofu
sudo systemctl status tofu
```

## Nginx

把 `deploy/nginx.tofu.conf` 复制到 `/etc/nginx/sites-available/tofu.conf`，再软链到 `sites-enabled`：

```bash
sudo ln -sf /etc/nginx/sites-available/tofu.conf /etc/nginx/sites-enabled/tofu.conf
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

如果 Cloudflare 只做 DNS，不走代理，服务器必须装公网可识别证书，比如 Let's Encrypt。

如果 Cloudflare 开橙云代理，可以在源站放 Cloudflare Origin CA 或公网证书，然后把 Cloudflare 的 SSL/TLS 模式设成 Full (strict)。

## Cloudflare 建议

如果 ECS 在中国大陆，而且主要是给中国大陆用户访问：

- 没有 Cloudflare China Network 企业版时，优先只用 Cloudflare 做 DNS，不开橙云代理。
- 开橙云代理虽然也能用，但中国大陆访问稳定性和时延不一定比直连更好。
- 如果你买的是 Cloudflare China Network，才适合把代理能力真正放到中国大陆访问链路里。

## 更新代码

```bash
cd /srv/tofu/current
git pull origin main
npm install
npm run build
sudo systemctl restart tofu
```

## 需要先确认的事

如果 ECS 在中国大陆，域名正式给外网用之前，需要完成 ICP 备案。没有备案，域名解析到中国大陆服务器后会被拦或者被要求下线。
