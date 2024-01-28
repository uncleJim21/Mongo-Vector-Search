#!/bin/bash

# Check if a command line argument was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <queryString>"
    exit 1
fi

# Assign the first command line argument to queryString
queryString="$1"

# Perform the curl request
curl -X POST http://localhost:5001/getResults \
    -H "Content-Type: application/json" \
    -d "{\"queryString\":\"$queryString\"}"
