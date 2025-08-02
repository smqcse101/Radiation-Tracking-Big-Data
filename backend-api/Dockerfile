# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install kafkajs

# Copy backend source code
COPY . .

# Expose port
EXPOSE 3001

# Start the backend service
CMD ["node", "kafkaApiService.js"]