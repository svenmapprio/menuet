# syntax=docker/dockerfile:1

FROM nginx
RUN apt-get update && apt-get install -y supervisor \
    && apt-get install -y --no-install-recommends \
    && apt-get install -y build-essential \
    && apt-get install -y python3 \
    && apt-get install curl \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs
WORKDIR /menuet/
COPY package.json package.json
RUN npm install
COPY app app 
COPY components components 
COPY contexts contexts 
COPY hooks hooks 
COPY public public 
COPY socket socket 
COPY styles styles 
COPY utils utils 
COPY .eslintrc.json next.config.js tsconfig.json ./
RUN npx next build
WORKDIR /
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]
EXPOSE 8080