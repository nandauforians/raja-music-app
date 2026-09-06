#!/bin/bash
BUCKET_NAME="uforian-karaoke-tracks"

cat <<EOF > cors.json
{
  "CORSRules": [
    {
      "AllowedHeaders": [
        "*"
      ],
      "AllowedMethods": [
        "GET",
        "HEAD"
      ],
      "AllowedOrigins": [
        "*"
      ],
      "ExposeHeaders": []
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file://cors.json
rm cors.json
echo "Bucket CORS updated successfully!"
