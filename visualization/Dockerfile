# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install serve globally
RUN npm install -g serve

# Copy frontend source code
COPY . .

# Expose port
EXPOSE 3000

# Start the frontend service
CMD ["serve", "-l", "3000", "-s", "."]