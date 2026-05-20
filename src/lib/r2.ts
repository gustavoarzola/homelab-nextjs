import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  return key
}

export async function getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return awsGetSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

export async function getR2Object(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const contentType = response.ContentType ?? 'application/octet-stream'
  const bytes = await response.Body!.transformToByteArray()
  return { buffer: Buffer.from(bytes), contentType }
}
