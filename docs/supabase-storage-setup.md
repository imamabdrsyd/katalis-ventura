# Supabase Storage Setup

## Profile Photo Upload

The Settings page allows users to upload profile photos. This requires a Supabase Storage bucket to be configured.

### Setup Steps

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Create Storage Bucket**
   - Go to Storage section in the left sidebar
   - Click "New bucket"
   - Bucket details:
     - **Name**: `profiles`
     - **Public bucket**: ✅ Enable (so profile photos can be accessed publicly)
     - Click "Create bucket"

3. **Set Bucket Policies**
   After creating the bucket, set up the following policies:

   **Policy 1: Allow authenticated users to upload**
   ```sql
   CREATE POLICY "Users can upload their own avatars"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'profiles'
     AND (storage.foldername(name))[1] = 'avatars'
   );
   ```

   **Policy 2: Allow public read access**
   ```sql
   CREATE POLICY "Public can view avatars"
   ON storage.objects
   FOR SELECT
   TO public
   USING (bucket_id = 'profiles');
   ```

   **Policy 3: Allow users to update their own avatars**
   ```sql
   CREATE POLICY "Users can update their own avatars"
   ON storage.objects
   FOR UPDATE
   TO authenticated
   USING (bucket_id = 'profiles')
   WITH CHECK (bucket_id = 'profiles');
   ```

   **Policy 4: Allow users to delete their own avatars**
   ```sql
   CREATE POLICY "Users can delete their own avatars"
   ON storage.objects
   FOR DELETE
   TO authenticated
   USING (bucket_id = 'profiles');
   ```

4. **Verify Setup**
   - Go to Settings page in the app
   - Try uploading a profile photo
   - The photo should upload successfully and display immediately
   - Check that the avatar URL is accessible publicly

### File Structure

Profile photos are stored with this structure:
```
profiles/
  avatars/
    {user_id}-{random}.{ext}
```

Example: `profiles/avatars/abc123-0.5234.jpg`

### Troubleshooting

**Error: "Failed to upload photo"**
- Check that the `profiles` bucket exists
- Verify bucket is set to public
- Ensure storage policies are created correctly

**Error: "Image not loading"**
- Check bucket is public
- Verify the SELECT policy allows public access
- Check browser console for CORS errors
