# bidblab-backend

The backend for Bidblab web app.

## Technology:

* Node.js v9
* Express.js v4
* Socket.io v2
* MongoDB v3.6
* Docker

## How to run manually?

1. Clone the repo
2. `npm i`
3. 
    * Development: 
        1. `npm start`
    * Production:
        1. `npm i -g pm2`
        2. `NODE_ENV=production pm2 start ./bin/www`

## How to run with docker?

1. Clone the repo.
2. 
   * Development: `docker-compose -f docker-compose.dev.yml up`
   * Production: 
      1. `docker swarm init`
      2. `docker stack deploy -c docker-compose.yml bidblab-backend`

&#9400; Omar Doma 2018
