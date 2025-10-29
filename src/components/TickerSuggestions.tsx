import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface TickerSuggestion {
    symbol: string;
    name: string;
}

interface TickerSuggestionsProps {
    suggestions: TickerSuggestion[];
    onSelect: (symbol: string) => void;
    visible: boolean;
}

export const TickerSuggestions: React.FC<TickerSuggestionsProps> = ({
    suggestions,
    onSelect,
    visible
}) => {
    if (!visible || suggestions.length === 0) return null;

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
                {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                        key={suggestion.symbol}
                        style={[
                            styles.suggestionItem,
                            index === suggestions.length - 1 && styles.lastItem
                        ]}
                        onPress={() => onSelect(suggestion.symbol)}
                    >
                        <Text style={styles.symbolText}>{suggestion.symbol}</Text>
                        <Text style={styles.companyText}>{suggestion.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'rgba(26, 31, 77, 0.95)',
        borderRadius: 12,
        maxHeight: 200,
        zIndex: 1000,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    scrollView: {
        maxHeight: 200,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastItem: {
        borderBottomWidth: 0,
    },
    symbolText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    companyText: {
        color: '#B4B9D9',
        fontSize: 14,
        flex: 1,
        textAlign: 'right',
        marginLeft: 12,
    },
});