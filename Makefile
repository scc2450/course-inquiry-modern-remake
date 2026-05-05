.PHONY: api web build-data test

api:
	uvicorn app.main:app --app-dir apps/api --reload --port 8000

web:
	npm --prefix apps/web run dev

build-data:
	python apps/api/scripts/build_index.py

test:
	pytest apps/api/tests
