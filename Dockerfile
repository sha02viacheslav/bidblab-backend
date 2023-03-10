FROM node:9

## Add metadata
LABEL version=1.0
LABEL maintainer="Dev Pony"

## Specify the "working directory" for the rest of the Dockerfile
WORKDIR /app

## Install packages using NPM 5 (bundled with the node:9 image)
COPY package.json /app
COPY package-lock.json /app
RUN npm install --quiet
RUN npm i -g pm2 --quiet

## Add application code
COPY . /app

## Allows port 3000 to be publicly available
EXPOSE 3000

## Set environment variables
ENV NODE_ENV production

## The command uses pm2 or node to run the application
# CMD ["node", "./bin/www"]
CMD ["pm2-docker", "start", "./bin/www"]