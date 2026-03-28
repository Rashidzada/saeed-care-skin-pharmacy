class PaginatedResponse<T> {
  const PaginatedResponse({
    required this.count,
    required this.results,
  });

  final int count;
  final List<T> results;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) mapper,
  ) {
    final rawResults = (json['results'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    return PaginatedResponse<T>(
      count: (json['count'] as num?)?.toInt() ?? rawResults.length,
      results: rawResults.map(mapper).toList(),
    );
  }
}
