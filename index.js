import express from 'express'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import cookieParser from "cookie-parser"
import cors from "cors"
import morgan from 'morgan'
import axios from 'axios'
import findmes from "./routes/findmes.js";
import auth from "./routes/auth.js";
import conversations from "./routes/conversations.js";
import users from "./routes/users.js";
import message from "./routes/message.js";
import calendarAppointment from "./routes/calendarAppointment.js";
import diary from "./routes/diary.js";
import file from "./routes/file.js";
import privacy from "./routes/privacy.js";
import personal from "./routes/personal.js";
import notification from "./routes/notification.js";
import fastMessage from "./routes/fastMessage.js";
import mail from "./routes/mail.js";
import logs from "./routes/logs.js";
import fs from 'fs'
import compression from 'compression'
import cmd from 'node-cmd'
import { notificationCalendar } from './controllers/calendarAppointment.js';
import formData from 'express-form-data';
const app=express();

dotenv.config();

const connect = async () => {
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/Chat365");
      console.log("Connected to mongoDB.");
    } catch (error) {
      throw error;
    }
  };

mongoose.connection.on("disconnected", () => {
  console.log("mongoDB disconnected!");
});

let date = Number(String(fs.readFileSync('utils/today.txt', 'utf8')));
let count= Number(String(fs.readFileSync('utils/request.txt', 'utf8')));
function countMiddleware(req,res,next){
   if(next)next()
   let takeDate = Number(new Date().getDate());
   if(takeDate != date){
     count =0;
     date = takeDate;
     fs.writeFileSync('utils/today.txt',String(date));
   };
   count++;
  //  console.log(count);
   fs.writeFileSync('utils/request.txt',String(count));
}

// app.use(untiInjection);
// app.use(countMiddleware);
app.use(compression());
app.use(cors()) // cho phép truy cập từ mọi client 
app.use(cookieParser())
// app.use(morgan('combined'))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");  
app.use(express.static("public"));

app.use("/api/conv", findmes);
app.use("/api/conv/auth", auth);
app.use("/api/conversations", conversations);
app.use("/api/users", users);
app.use("/api/message", message);
app.use("/api/diary", diary);
app.use("/api/calendarappointment", calendarAppointment)
// app.use("/api/blockuser", blockUser)
app.use("/api/file", file)
app.use("/api/personal", personal);
app.use("/api/V2/Notification",notification)
app.use("/api/privacy", privacy)
app.use("/api/mail", mail);
app.use("/api/logs", logs)
app.use("/api/fastMessage", fastMessage)
// app.listen(process.env.PORT ||9000,()=>{
//     connect();
//     console.log("Connected to databse");
//     console.log("Backend is running on http://localhost:9000")
// })
// setInterval(()=>{
//   axios.get('https://api-booking-app-aws-ec2.onrender.com/homepage.html').catch((e)=>{
//     console.log(e)
//   })
// },2000)
app.get('/restart', async (req, res) => {
  try {
    await cmd.runSync('pm2 stop index');
    await cmd.runSync('pm2 start index');
    res.send('Xong')
  }
  catch (e) {
    console.log('error restart', e);
  }
})
//FE 
app.get("/frontend/takeHistoryAccess",(req,res)=>{
  return res.render("takeHistoryAccess");
});
const myConsole = new console.Console(fs.createWriteStream('./logs/IpHome.log'));
app.get("/takeiphome",(req,res)=>{
  myConsole.log(req.ip);
  return res.json("Chau lay dc r a");
});
app.listen(9000,()=>{
  connect();
  console.log("Connected to databse");
  console.log("Backend is running on http://localhost:9000")
})

notificationCalendar()