#!/bin/bash

# Start the first process
npx next dev &

# Start the second process
pm2 socket/init.js &

# Start the second process
nginx &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?