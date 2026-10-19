FROM python:3.12-alpine

WORKDIR /site

COPY index.html ./
COPY app.js ./
COPY data.js ./
COPY sandbox-data.js ./
COPY structure-assets.js ./
COPY styles.css ./
COPY favicon.png ./
COPY vendor ./vendor
COPY fonts ./fonts
COPY structures ./structures
COPY generated ./generated

EXPOSE 3000

CMD ["python", "-m", "http.server", "3000"]
