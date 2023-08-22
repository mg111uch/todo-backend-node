var express = require('express');
const cors=require("cors");
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(express.json()).post('/getItems', (req, res) => {
    var myjson = JSON.parse(req.body.body);
    console.log(myjson);
    res.json([{id:'000', name: 'Backend Item'}])
});

app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });