FROM golang:1.24 as builder
WORKDIR /src
RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build --with github.com/grafana/xk6-output-influxdb

FROM grafana/k6:latest
COPY --from=builder /src/k6 /usr/bin/k6