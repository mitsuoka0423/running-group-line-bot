# Use the official Node.js image
FROM node:18

# Install clasp globally
RUN npm install -g @google/clasp

# Set the working directory
WORKDIR /workspace

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Install TypeScript
RUN npm install -g typescript

# Install Biome
RUN npm install -g @biomejs/biome

# Set up the default command
CMD ["bash"]
