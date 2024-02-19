# Sử dụng một hình ảnh Node.js
FROM node:14

# Thiết lập thư mục làm việc trong container
WORKDIR /usr/src/app

# Sao chép package.json và package-lock.json (nếu có) vào thư mục làm việc
COPY package*.json ./

# Cài đặt các dependencies
RUN npm install

# Sao chép tất cả các file trong dự án vào thư mục làm việc
COPY . .

# Mở cổng 3000 cho ứng dụng của bạn
EXPOSE 3000

# Command để chạy ứng dụng của bạn
CMD ["npm", "start"]
