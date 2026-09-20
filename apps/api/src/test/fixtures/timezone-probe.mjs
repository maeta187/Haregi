// package.json のコマンドが起動する Node に --import して、アプリ実行前の TZ を観測する。
console.log(JSON.stringify({ timezone: process.env.TZ }))
process.exit(0)
