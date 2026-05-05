# Course Inquiry Modern

一个更稳的 PKU 课程查询重构实验：FastAPI 后端 + React 前端，保留原 Streamlit 版本的在线查询和离线 CSV 查询思路，但把界面、API、数据索引拆开维护。

## 技术选择

- `apps/api`: FastAPI, SQLite, 标准库 CSV 导入。离线查询不依赖 pandas，适合容器部署。
- `apps/web`: React + Vite + TypeScript。前端只调用 API，不直接接触 PKU 或 CSV。
- `apps/api/scripts`: 数据同步和索引构建脚本。默认用内置样例数据启动，生产环境可同步完整上游 CSV。

## 本地启动

```bash
cd /Users/erik/Documents/Sandbox/course-inquiry-modern
python3 -m venv .venv
. .venv/bin/activate
pip install -e apps/api
uvicorn app.main:app --app-dir apps/api --reload --port 8000
```

另开一个终端：

```bash
cd /Users/erik/Documents/Sandbox/course-inquiry-modern/apps/web
npm install
npm run dev
```

前端默认访问 `http://localhost:5173`，后端默认访问 `http://localhost:8000`。

## 同步完整课程数据

仓库默认只放一小份样例 CSV，方便无网络启动。要拉取原始仓库中的完整离线 CSV：

```bash
cd /Users/erik/Documents/Sandbox/course-inquiry-modern
. .venv/bin/activate
python apps/api/scripts/sync_upstream_data.py
python apps/api/scripts/build_index.py
```

同步来源是公开仓库 `scc2450/CourseInquiry` 的 `file/**/*.csv`。完整 CSV 不建议直接提交到新仓库，推荐把同步步骤放到部署构建或定时任务里。

## API

- `GET /health`: 健康检查
- `GET /api/meta`: 可用学年、学期、课表类型、课程类型、院系列表
- `GET /api/courses/search`: 查询课程，支持 `source=offline|online`
- `GET /api/courses/export.csv`: 导出当前离线筛选结果

## 部署建议

最省心的生产组合是：

- 前端：Vercel 或 Cloudflare Pages
- 后端：Render, Railway, Fly.io 或自管 VPS Docker
- 数据：SQLite 文件随后端部署；如果要多实例或定时更新，迁到 Postgres

如果希望一个容器搞定，使用 `Dockerfile.api` 跑后端，再把 `apps/web/dist` 由 Nginx 或 Caddy 托管即可。
