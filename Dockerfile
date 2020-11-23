FROM node:12.16-alpine as builder
WORKDIR /opt/iotplatform-preprocessor
COPY . /opt/iotplatform-preprocessor
RUN npm install && npm run build:production

FROM node:12.16-alpine as production
ENV NODE_ENV=production
RUN apk add --no-cache tini
WORKDIR /opt/iotplatform-preprocessor
COPY --from=builder /opt/iotplatform-preprocessor/build/bundle.js ./build/
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "/opt/iotplatform-preprocessor/build/bundle.js"]
