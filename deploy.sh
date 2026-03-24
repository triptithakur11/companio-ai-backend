zip -r backend.zip . -x "node_modules/*" ".git/*" ".env" "*.log" "backend.zip"

az webapp deploy \
  --resource-group Tripti-Thakur-RG \
  --name companio-ai-backend-tripti-new \
  --src-path backend.zip