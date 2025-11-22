#!/bin/bash

# ADS Platform - Oasis ROFL Deployment Script
# This script automates the deployment of the signing backend to Oasis ROFL TEE

set -e  # Exit on error

echo "=================================================="
echo "ADS Platform - Oasis ROFL Deployment"
echo "=================================================="
echo ""

# Configuration
DOCKER_IMAGE="${DOCKER_IMAGE:-your-dockerhub-username/ads-backend}"
DOCKER_TAG="${DOCKER_TAG:-latest}"
NETWORK="${NETWORK:-testnet}"
APP_NAME="ads-signing-backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
echo "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v oasis &> /dev/null; then
    echo -e "${YELLOW}Warning: Oasis CLI not found. Installing...${NC}"
    npm install -g @oasisprotocol/cli
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Step 1: Build Docker Image
echo "=================================================="
echo "Step 1: Building Docker Image"
echo "=================================================="
cd backend

echo "Building ${DOCKER_IMAGE}:${DOCKER_TAG}..."
docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .

echo -e "${GREEN}✓ Docker image built${NC}"
echo ""

# Step 2: Test Docker Image Locally (optional)
read -p "Test Docker image locally? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Testing Docker image..."
    echo "Enter SIGNER_PRIVATE_KEY for testing (or press Enter to skip):"
    read -s SIGNER_PRIVATE_KEY

    if [ ! -z "$SIGNER_PRIVATE_KEY" ]; then
        docker run -d -p 3001:3001 -e SIGNER_PRIVATE_KEY=${SIGNER_PRIVATE_KEY} --name ads-backend-test ${DOCKER_IMAGE}:${DOCKER_TAG}
        sleep 3
        echo "Testing health endpoint..."
        curl http://localhost:3001/health
        docker stop ads-backend-test
        docker rm ads-backend-test
        echo -e "${GREEN}✓ Docker image tested successfully${NC}"
    fi
fi

echo ""

# Step 3: Push to Docker Hub
echo "=================================================="
echo "Step 2: Pushing to Docker Hub"
echo "=================================================="

read -p "Push to Docker Hub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing ${DOCKER_IMAGE}:${DOCKER_TAG}..."
    docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
    echo -e "${GREEN}✓ Image pushed to Docker Hub${NC}"
else
    echo -e "${YELLOW}Skipping Docker Hub push${NC}"
fi

cd ..
echo ""

# Step 4: Update rofl.yaml
echo "=================================================="
echo "Step 3: Updating rofl.yaml"
echo "=================================================="

# Update image in rofl.yaml
sed -i.bak "s|image:.*|image: ${DOCKER_IMAGE}:${DOCKER_TAG}|" rofl.yaml

echo -e "${GREEN}✓ rofl.yaml updated with image: ${DOCKER_IMAGE}:${DOCKER_TAG}${NC}"
echo ""

# Step 5: Register App (if not already registered)
echo "=================================================="
echo "Step 4: Register App on Oasis (if needed)"
echo "=================================================="

read -p "Do you need to register a new app? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Registering app on Oasis ${NETWORK}..."
    oasis rofl create \
        --network ${NETWORK} \
        --name ${APP_NAME} \
        --manifest rofl.yaml

    echo ""
    echo -e "${YELLOW}IMPORTANT: Save the App ID from above!${NC}"
    echo "Enter the App ID:"
    read APP_ID

    echo -e "${GREEN}✓ App registered with ID: ${APP_ID}${NC}"
else
    echo "Enter your existing App ID:"
    read APP_ID
fi

echo ""

# Step 6: Set Private Key Secret
echo "=================================================="
echo "Step 5: Configure Secrets"
echo "=================================================="

read -p "Set/update SIGNER_PRIVATE_KEY secret? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter SIGNER_PRIVATE_KEY (will not be displayed):"
    read -s SIGNER_PRIVATE_KEY
    echo ""

    echo "Setting secret..."
    oasis rofl secret set SIGNER_PRIVATE_KEY \
        --app-id ${APP_ID} \
        --value "${SIGNER_PRIVATE_KEY}" \
        --network ${NETWORK}

    echo -e "${GREEN}✓ Secret configured${NC}"
fi

echo ""

# Step 7: Build Deployment Bundle
echo "=================================================="
echo "Step 6: Building Deployment Bundle"
echo "=================================================="

OUTPUT_FILE="ads-backend-${DOCKER_TAG}.orc"

echo "Building ${OUTPUT_FILE}..."
oasis rofl build \
    --manifest rofl.yaml \
    --output ${OUTPUT_FILE}

echo -e "${GREEN}✓ Bundle created: ${OUTPUT_FILE}${NC}"
echo ""

# Step 8: Deploy to ROFL
echo "=================================================="
echo "Step 7: Deploying to Oasis ROFL"
echo "=================================================="

read -p "Deploy to Oasis ROFL ${NETWORK}? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying to ROFL providers..."
    oasis rofl deploy ${OUTPUT_FILE} \
        --network ${NETWORK} \
        --app-id ${APP_ID}

    echo ""
    echo -e "${GREEN}✓ Deployment complete!${NC}"
else
    echo -e "${YELLOW}Deployment skipped${NC}"
    echo "To deploy manually, run:"
    echo "  oasis rofl deploy ${OUTPUT_FILE} --network ${NETWORK} --app-id ${APP_ID}"
fi

echo ""

# Step 9: Verify Deployment
echo "=================================================="
echo "Step 8: Verification"
echo "=================================================="

echo "Fetching app info..."
oasis rofl info --app-id ${APP_ID} --network ${NETWORK}

echo ""
echo -e "${GREEN}=================================================="
echo "Deployment Summary"
echo "==================================================${NC}"
echo "App ID: ${APP_ID}"
echo "Network: ${NETWORK}"
echo "Docker Image: ${DOCKER_IMAGE}:${DOCKER_TAG}"
echo ""
echo "Next steps:"
echo "1. Check logs: oasis rofl logs --app-id ${APP_ID} --network ${NETWORK}"
echo "2. Test endpoint: curl https://ads-backend-${APP_ID}.rofl.oasis.io/health"
echo "3. Update .env.local: NEXT_PUBLIC_BACKEND_API_URL=https://ads-backend-${APP_ID}.rofl.oasis.io"
echo ""
echo -e "${GREEN}Done!${NC}"
