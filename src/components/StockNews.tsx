import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';

interface NewsItemProps {
    title: string;
    url: string;
}

interface StockNewsProps {
    ticker: string;
    newsItems: NewsItemProps[];
    isLoading: boolean;
    error: string | null;
}

export const StockNews: React.FC<StockNewsProps> = ({ ticker, newsItems, isLoading, error }) => {
    const handleLinkPress = async (url: string) => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading news...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!newsItems || newsItems.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.noNewsText}>No news articles found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Latest News for {ticker}</Text>
            {newsItems.map((item, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.newsItem}
                    onPress={() => handleLinkPress(item.url)}
                >
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    <Text style={styles.readMore}>Read more →</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 32,
        padding: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
        textShadowColor: 'rgba(78, 107, 255, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    newsItem: {
        padding: 16,
        backgroundColor: 'rgba(78, 107, 255, 0.1)',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(78, 107, 255, 0.2)',
    },
    newsTitle: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 12,
        lineHeight: 24,
    },
    readMore: {
        fontSize: 14,
        color: '#4E6BFF',
        fontWeight: '600',
    },
    loadingText: {
        color: '#B4B9D9',
        textAlign: 'center',
        fontSize: 16,
        padding: 20,
    },
    errorText: {
        color: '#FF4444',
        textAlign: 'center',
        fontSize: 16,
        padding: 20,
    },
    noNewsText: {
        color: '#B4B9D9',
        textAlign: 'center',
        fontSize: 16,
        padding: 20,
    },
});