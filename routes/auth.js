import express from "express";
import formData from 'express-form-data';
import { login } from "../controllers/auth.js";
import { confirmlogin } from "../controllers/auth.js";
import { takedatatoverifylogin } from "../controllers/auth.js";  
import { confirmotp } from "../controllers/auth.js";
import { takedatatoverifyloginV2 } from "../controllers/auth.js"; 
import { takedatatoverifyloginV3 } from "../controllers/auth.js"; 
import { AcceptLogin } from "../controllers/auth.js"; 
import { refreshtoken } from "../controllers/auth.js";
import { register } from "../controllers/auth.js";
import multer from 'multer';
const router = express.Router();
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/avatarUser'); // Set the destination folder
    },
    filename: function (req, file, cb) {
      const fileName = `${file.originalname}`;
      cb(null, fileName);
    },
  });
const upload = multer({storage});
router.post("/login",formData.parse(),login) 
router.post("/confirmlogin",formData.parse(), confirmlogin)
router.post("/confirmotp",formData.parse(), confirmotp)
router.get("/takedatatoverifylogin/:userId", takedatatoverifylogin);
router.get("/takedatatoverifyloginV2/:userId", takedatatoverifyloginV2)
router.post("/AcceptLogin", formData.parse(), AcceptLogin);
router.post("/refreshtoken", formData.parse(), refreshtoken)
router.post("/register",upload.single('avatar'), register)
router.get("/takedatatoverifyloginV3/:userId", takedatatoverifyloginV3)
export default router