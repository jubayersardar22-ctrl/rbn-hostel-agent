import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => StylingViewModel()),
      ],
      child: const ThreadconApp(),
    ),
  );
}

class ThreadconApp extends StatelessWidget {
  const ThreadconApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Threadcon Virtual Styling',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const StylingScreen(),
    );
  }
}

// Model
class Message {
  final String text;
  final bool isUser;
  final String? imageUrl;

  Message({required this.text, required this.isUser, this.imageUrl});
}

// ViewModel (MVVM Architecture)
class StylingViewModel extends ChangeNotifier {
  final List<Message> _messages = [
    Message(text: "Hello! I'm your Threadcon Styling Agent. Upload a photo or tell me what outfit you're looking for!", isUser: false)
  ];
  bool _isLoading = false;

  List<Message> get messages => _messages;
  bool get isLoading => _isLoading;

  Future<void> sendMessage(String text, {String? imagePath}) async {
    if (text.isEmpty && imagePath == null) return;

    _messages.add(Message(text: text, isUser: true, imageUrl: imagePath));
    _isLoading = true;
    notifyListeners();

    try {
      // Connects to Go ADK Backend
      final response = await http.post(
        Uri.parse('http://127.0.0.1:8080/api/chat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'session_id': 'session_123',
          'input': text,
          'image_url': imagePath ?? '',
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _messages.add(Message(
          text: data['response'],
          isUser: false,
          imageUrl: data['generated_img'] != "" ? data['generated_img'] : null,
        ));
      } else {
        _messages.add(Message(text: "Error communicating with Go Backend.", isUser: false));
      }
    } catch (e) {
      _messages.add(Message(text: "Server is unreachable. Please run the Go backend.", isUser: false));
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

// View
class StylingScreen extends StatelessWidget {
  const StylingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<StylingViewModel>();
    final TextEditingController controller = TextEditingController();

    return Scaffold(
      appBar: AppBar(title: const Text('Threadcon Styling & Fitting')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              itemCount: viewModel.messages.length,
              itemBuilder: (context, index) {
                final msg = viewModel.messages[index];
                return ListTile(
                  title: Align(
                    alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: msg.isUser ? Colors.blue[100] : Colors.grey[200],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (msg.imageUrl != null)
                            Image.network(msg.imageUrl!, height: 150, errorBuilder: (c, e, s) => const Icon(Icons.broken_image)),
                          if (msg.text.isNotEmpty) Text(msg.text),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (viewModel.isLoading) const CircularProgressIndicator(),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.image),
                  onPressed: () async {
                    // Simulating image upload via picker
                    final ImagePicker picker = ImagePicker();
                    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
                    if (image != null) {
                      // In a real app, upload to GCS first, then send URL to backend.
                      viewModel.sendMessage("I uploaded a photo. Can you fit a summer dress on it?", imagePath: "https://storage.googleapis.com/demo-images/user_upload.jpg");
                    }
                  },
                ),
                Expanded(
                  child: TextField(
                    controller: controller,
                    decoration: const InputDecoration(hintText: 'Ask the Styling Agent...'),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: () {
                    viewModel.sendMessage(controller.text);
                    controller.clear();
                  },
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
