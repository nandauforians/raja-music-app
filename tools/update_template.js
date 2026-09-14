const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../template.yaml');
let code = fs.readFileSync(filePath, 'utf8');

const newFunctions = `
  OpenDuetFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: backend/
      Handler: lambda_functions.openDuet
      Runtime: nodejs18.x
      Environment:
        Variables:
          MONGODB_URI: '{{resolve:ssm:mongodb_uri:1}}'
          KARAOKE_BUCKET: uforian-karaoke-tracks
      Policies:
        - Statement:
            - Effect: Allow
              Action:
                - s3:PutObject
              Resource: 'arn:aws:s3:::uforian-karaoke-tracks/*'
      Events:
        OpenDuetApi:
          Type: Api
          Properties:
            Path: /duet/open
            Method: post
            RestApiId: !Ref ApiGatewayApi

  GetOpenDuetsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: backend/
      Handler: lambda_functions.getOpenDuets
      Runtime: nodejs18.x
      Environment:
        Variables:
          MONGODB_URI: '{{resolve:ssm:mongodb_uri:1}}'
      Events:
        GetOpenDuetsApi:
          Type: Api
          Properties:
            Path: /duets/open
            Method: get
            RestApiId: !Ref ApiGatewayApi

  JoinDuetFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: backend/
      Handler: lambda_functions.joinDuet
      Runtime: nodejs18.x
      Environment:
        Variables:
          MONGODB_URI: '{{resolve:ssm:mongodb_uri:1}}'
          KARAOKE_BUCKET: uforian-karaoke-tracks
      Policies:
        - Statement:
            - Effect: Allow
              Action:
                - s3:PutObject
              Resource: 'arn:aws:s3:::uforian-karaoke-tracks/*'
      Events:
        JoinDuetApi:
          Type: Api
          Properties:
            Path: /duet/join
            Method: post
            RestApiId: !Ref ApiGatewayApi
`;

if (!code.includes("OpenDuetFunction")) {
  code = code.replace(/Outputs:/, newFunctions + "\nOutputs:");
  fs.writeFileSync(filePath, code);
  console.log('Added to template.yaml');
}
