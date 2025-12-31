import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private readonly BUCKET_NAME = 'pulse-media';

  onModuleInit() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  Supabase credentials not configured. Media uploads will not work.');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    console.log('✅ Supabase Storage client initialized');
  }

  /**
   * Generate a signed upload URL for direct client uploads
   * This prevents files from going through the backend server
   * 
   * @param filePath - Path where file will be stored (e.g., "conversations/uuid/file.jpg")
   * @param expiresIn - URL expiration in seconds (default: 5 minutes)
   */
  async generateSignedUploadUrl(
    filePath: string,
    expiresIn: number = 300,
  ): Promise<{ signedUrl: string; path: string; token: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUploadUrl(filePath, {
        upsert: false, // Don't allow overwriting existing files
      });

    if (error) {
      throw new Error(`Failed to generate signed upload URL: ${error.message}`);
    }

    return {
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    };
  }

  /**
   * Generate a signed URL for downloading/viewing a file
   * Used for private media access
   * 
   * @param filePath - Path to the file
   * @param expiresIn - URL expiration in seconds (default: 1 hour)
   */
  async generateSignedDownloadUrl(
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed download URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Get public URL for a file (only works if bucket is public)
   * For production, use signed URLs instead
   */
  getPublicUrl(filePath: string): string {
    const { data } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Delete a file from storage
   * Used when deleting messages
   */
  async deleteFile(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Check if storage bucket exists, create if not
   * Run this during setup
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets, error } = await this.supabase.storage.listBuckets();

      if (error) {
        console.error('Failed to list buckets:', error.message);
        return;
      }

      const bucketExists = buckets?.some((b) => b.name === this.BUCKET_NAME);

      if (!bucketExists) {
        const { error: createError } = await this.supabase.storage.createBucket(
          this.BUCKET_NAME,
          {
            public: false, // Private bucket for security
            fileSizeLimit: 20971520, // 20MB limit
          },
        );

        if (createError) {
          console.error('Failed to create bucket:', createError.message);
        } else {
          console.log(`✅ Created bucket: ${this.BUCKET_NAME}`);
        }
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error.message);
    }
  }
}
