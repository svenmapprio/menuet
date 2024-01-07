# syntax=docker/dockerfile:1

FROM nginx

# Install necessary packages and dependencies for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg ca-certificates procps libxss1 \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get install -y supervisor \
    && apt-get install -y build-essential \
    && apt-get install -y python3 \
    && apt-get install -y curl

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs

WORKDIR /menuet/
COPY package.json package.json
RUN npm install

# Copy your application files
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
