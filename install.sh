# backend config
cd c-slang
yarn install
yarn build
yarn link

# frontend config
cd ../frontend
yarn install
yarn link "c-slang"
yarn run start