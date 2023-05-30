#!/bin/bash

# Start the first process
npx next start -p 3000 &

# Start the second process
nginx -c /menuet/nginx.conf

# Start the second process
# pm2-runtime socket/init.js

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?