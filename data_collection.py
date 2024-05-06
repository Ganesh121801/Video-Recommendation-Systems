import json
import logging
from googleapiclient.discovery import build
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
import numpy as np
import re

# Initialize logging
logging.basicConfig(filename='data_collection.log', level=logging.DEBUG)


API_KEY = 'AIzaSyCVPuydS09aU7eOCuUhohNaE3ap47AMosM' 

# Initialize YouTube API client
youtube = build('youtube', 'v3', developerKey=API_KEY)

# Data collection function
def collect_youtube_data(query, max_results=50):
    # Fetch video data
    search_response = youtube.search().list(
        part='snippet',
        q=query,
        type='video',
        maxResults=max_results
    ).execute()

    video_data = []
    video_ids = [item['id']['videoId'] for item in search_response['items']]

    # Fetch video details
    video_details = youtube.videos().list(
        part='snippet,contentDetails,statistics',
        id=','.join(video_ids)
    ).execute()

    # Process video details
    for item in video_details['items']:
        try:
            video_id = item['id']
            title = item['snippet']['title']
            description = item['snippet']['description']
            thumbnail_url = item['snippet']['thumbnails']['default']['url']
            view_count = int(item['statistics'].get('viewCount', 0))
            like_count = int(item['statistics'].get('likeCount', 0))
            comment_count = int(item['statistics'].get('commentCount', 0))
            duration = item['contentDetails']['duration']

            # Convert ISO 8601 duration to seconds
            total_seconds = iso8601_to_seconds(duration)

            # Filter videos based on duration and presence of thumbnail
            if total_seconds >= 60 and thumbnail_url:
                video_data.append({
                    'title': title,
                    'description': description,
                    'thumbnailUrl': thumbnail_url,
                    'viewCount': view_count,
                    'likeCount': like_count,
                    'commentCount': comment_count,
                    'duration': duration,
                    'durationSeconds': total_seconds,
                })
        except KeyError as e:
            logging.error(f"Missing data for video {item['id']} - {e}")
            continue

    return video_data

# Preprocess data
def preprocess_data(video_data):
    # Convert data to DataFrame
    df = pd.DataFrame(video_data)

    # Combine title and description for TF-IDF
    df['content'] = df['title'] + ' ' + df['description']

    # Create TF-IDF vectorizer
    tfidf_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')

    tfidf_features = tfidf_vectorizer.fit_transform(df['content'])

    return tfidf_features, df, tfidf_vectorizer

def generate_recommendations(query, df, tfidf_features, tfidf_vectorizer):


    query_vector = tfidf_vectorizer.transform([query])

    similarity_scores = cosine_similarity(query_vector, tfidf_features)[0]

    top_k_indices = similarity_scores.argsort()[-20:]

    # Retrieve recommended videos
    recommendations = []
    for idx in top_k_indices:
        video = df.iloc[idx]
        recommendations.append({
            'title': video['title'],
            'description': video['description'],
            'thumbnailUrl': video['thumbnailUrl'],
            'videoLink': f'https://www.youtube.com/watch?v={video["title"]}'
        })

    return recommendations

# Convert ISO 8601 duration to seconds
def iso8601_to_seconds(duration):
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
    if not match:
        return None
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    seconds = int(match.group(3)) if match.group(3) else 0
    return hours * 3600 + minutes * 60 + seconds

# Save recommendations to JSON file
def save_recommended_videos_to_json(recommendations, file_name='recommended_videos.json'):
    with open(file_name, 'w') as json_file:
        json.dump(recommendations, json_file, indent=4)

# Main function
def main():
    query = 'physics wall'  # Replace with your query

    # Collect data and preprocess it
    video_data = collect_youtube_data(query)

    # Preprocess data
    tfidf_features, df, tfidf_vectorizer = preprocess_data(video_data)

    # Generate recommendations
    recommendations = generate_recommendations(query, df, tfidf_features, tfidf_vectorizer)

    # Save recommendations to JSON file
    save_recommended_videos_to_json(recommendations)

    # Output recommendations
    print("Recommended videos:")
    print(recommendations)

if __name__ == '__main__':
    main()