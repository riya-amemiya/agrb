#!/bin/bash
# check actions
echo "Checking actions..."
actionlint
echo "Actionlint passed"

# check ghalint
echo "Checking ghalint..."
ghalint run
echo "Ghalint passed"

# check zizmor
echo "Checking zizmor..."
zizmor .
echo "Zizmor passed"

echo "All checks passed"