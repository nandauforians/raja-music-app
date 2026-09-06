#!/bin/bash

# You need to replace CLOUDFRONT_OAI_ID with the actual Origin Access Identity ID
# that is created by the SAM template. You can find this in the AWS Console under CloudFront.
CLOUDFRONT_OAI_ID="E17OUMTX6ZBUU3"
BUCKET_NAME="uforian-karaoke-tracks"

cat <<EOF > policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "CanonicalUser": "406a5a4376824a6addfcadda0dc2e7666f12931332980f28e86adef050f625c6615a8a84d73288263b030a3f790ffa79"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::uforian-karaoke-tracks/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://policy.json
rm policy.json
echo "Bucket policy updated successfully!"
