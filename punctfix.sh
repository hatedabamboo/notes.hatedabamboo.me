#!/bin/bash

set -euo pipefail

if [ "$#" -ne "1" ]; then
  echo "Provide filename"
  exit 1
fi

file=$1

sed -i 's/—/--/g' $file
sed -i "s/’/'/g" $file
sed -i 's/“/"/' $file
sed -i 's/”/"/' $file
