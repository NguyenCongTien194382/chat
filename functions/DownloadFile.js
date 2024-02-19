
import fs from 'fs';
import axios from 'axios';
import path from 'path'

export const downloadFile = async (url, type) => {
   try {
      if ((String(type) === "pdf") || (String(type) === "png")) {
         const __dirname = path.resolve();
         const fileName = `${Date.now() * 10000 + 621355968000000000}cv.${type}`;
         const path1 = path.resolve(__dirname, 'C:/Chat365/publish/wwwroot/uploads', fileName)
         const writer = fs.createWriteStream(path1)

         const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
         })

         response.data.pipe(writer)
         return fileName;
      }
      else {
         return false;
      }
   }
   catch (e) {
      console.log(e);
      return false;
   }

}

export const convertBase64ToPDF = async (base64Data) => {
   try {
      const buffer = Buffer.from(base64Data, 'base64');
      const __dirname = path.resolve();
      const fileName = `${Date.now() * 10000 + 621355968000000000}cv.pdf`;
      const path1 = path.resolve(__dirname, 'C:/Chat365/publish/wwwroot/uploads', fileName)
      fs.writeFile(path1, buffer, (err) => {
         if (err) {
            console.error('Lỗi khi ghi tệp PDF:', err);
            return false
         } else {
            console.log('Tệp PDF đã được tạo thành công:');
            return fileName
         }
      });
   } catch (e) {
      console.log(e);
      return false;
   }
};