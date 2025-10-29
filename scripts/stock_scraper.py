from bs4 import BeautifulSoup
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def scrape_stock_news(ticker):
    try:
        # Using MarketWatch as an example source
        url = f"https://www.marketwatch.com/investing/stock/{ticker}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find news articles
        articles = []
        news_elements = soup.find_all('div', {'class': 'article__content'})
        
        for element in news_elements[:5]:  # Limit to 5 articles
            title_element = element.find('a', {'class': 'link'})
            if title_element:
                title = title_element.text.strip()
                link = title_element.get('href')
                if not link.startswith('http'):
                    link = f"https://www.marketwatch.com{link}"
                articles.append({
                    'title': title,
                    'url': link
                })
        
        return articles
    except Exception as e:
        print(f"Error scraping news: {str(e)}")
        return []

@app.route('/api/stock-news/<ticker>')
def get_stock_news(ticker):
    articles = scrape_stock_news(ticker)
    return jsonify({
        'status': 'success',
        'data': articles
    })

if __name__ == '__main__':
    app.run(port=5000)