  "use client"

  import { useState, useEffect } from "react"
  import { MessageCircle, X, ShoppingBag, Phone, HelpCircle } from "lucide-react"
  import { Button } from "@/components/ui/button"
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
  import { Input } from "@/components/ui/input"
  import { useChat } from "ai/react"

  enum ChatMode {
    General = 0,
    Shopping = 1,
    Contact = 2,
  }

  interface Message {
    role: "user" | "assistant"
    content: string
  }

  export function Chatbot() {
    const [isOpen, setIsOpen] = useState(false)
    const [mode, setMode] = useState<ChatMode>(ChatMode.General)
    const [shoppingMessages, setShoppingMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [shoppingState, setShoppingState] = useState({
      step: "welcome",
      category: "",
      size: "",
      color: "",
    })
    const [options, setOptions] = useState<string[]>([])

    const { messages: generalMessages, input, handleInputChange, handleSubmit: originalHandleSubmit } = useChat()

    useEffect(() => {
      if (mode === ChatMode.Shopping && shoppingState.step === "welcome") {
        setShoppingMessages([
          {
            role: "assistant",
            content:
              "Welcome to our shopping assistant! I'm here to help you find the perfect item. What type of product are you looking for today?",
          },
        ])
        fetchOptions("get_categories")
      }
    }, [mode, shoppingState.step])

    const toggleChat = () => setIsOpen(!isOpen)

    const fetchOptions = async (apiInput: string) => {
      setIsLoading(true)
      try {
        const response = await fetch("http://localhost:5000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice: "2", input: apiInput }),
        })
        if (response.ok) {
          const data = await response.json()
          setOptions(data.content)
        }
      } catch (error) {
        console.error("Error fetching options:", error)
      } finally {
        setIsLoading(false)
      }
    }

    const handleOptionClick = async (option: string) => {
      const userMessage: Message = { role: "user", content: option }
      setShoppingMessages((prev) => [...prev, userMessage])

      let nextStep: string
      let apiInput: string

      if (option.toLowerCase() === "no") {
          // Quit the shopping assistant
          setShoppingMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Thanks for shopping with me today! Hope to see you again soon! 👋" }
          ]);
          setShoppingState({ step: "welcome", category: "", size: "", color: "" });
          return; // Exit the function
      }

      switch (shoppingState.step) {
          case "welcome":
          case "category":
              nextStep = "size"
              apiInput = `get_sizes ${option}`
              setShoppingState((prev) => ({ ...prev, category: option, step: nextStep }))
              break
          case "size":
              nextStep = "color"
              apiInput = `get_colors ${shoppingState.category} ${option}`
              setShoppingState((prev) => ({ ...prev, size: option, step: nextStep }))
              break
          case "color":
              nextStep = "product"
              apiInput = `find_products ${shoppingState.category} ${shoppingState.size} ${option}`
              setShoppingState((prev) => ({ ...prev, color: option, step: nextStep }))
              break
          default:
              nextStep = "category"
              apiInput = "get_categories"
              setShoppingState({ step: "category", category: "", size: "", color: "" })
      }

      setIsLoading(true)
      try {
          const response = await fetch("http://localhost:5000/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ choice: "2", input: apiInput }),
          })
          if (response.ok) {
              const data = await response.json()
              let assistantMessage: Message
              if (nextStep === "product") {
                  assistantMessage = {
                      role: "assistant",
                      content:
                          "Here are some products you might like:\n" +
                          data.content
                              .slice(0, 4) // Limit to 4 recommendations
                              .map((product: any) => `- ${product.name} by ${product.company}: ${product.recommendation}`)
                              .join("\n") +
                          "\n\nWould you like to look for something else?",
                  }
                  setOptions(["Yes", "No"]) // Options to continue or quit
              } else {
                  assistantMessage = {
                      role: "assistant",
                      content: getNextStepPrompt(nextStep),
                  }
                  setOptions(data.content)
              }
              setShoppingMessages((prev) => [...prev, assistantMessage])
          }
      } catch (error) {
          console.error("Error:", error)
          const errorMessage: Message = { role: "assistant", content: "Sorry, I encountered an error. Please try again." }
          setShoppingMessages((prev) => [...prev, errorMessage])
      } finally {
          setIsLoading(false)
      }
    }

    const getNextStepPrompt = (step: string) => {
      switch (step) {
        case "size":
          return `Great! For ${shoppingState.category}, what size are you looking for?`
        case "color":
          return `Excellent choice! Now, what color would you prefer for the ${shoppingState.category} in size ${shoppingState.size}?`
        default:
          return "What type of product are you looking for today?"
      }
    }

    const handleGeneralSubmit = async (event: React.FormEvent) => {
      event.preventDefault()
      const userMessage: Message = { role: "user", content: input }
      generalMessages.push(userMessage)

      setIsLoading(true)
      try {
        const response = await fetch("http://localhost:5000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice: "1", input }),
        })
        if (response.ok) {
          const data = await response.json()
          const assistantMessage: Message = {
            role: "assistant",
            content: data.content,
          }
          generalMessages.push(assistantMessage)
        }
      } catch (error) {
        console.error("Error:", error)
        const errorMessage: Message = { role: "assistant", content: "Sorry, I encountered an error. Please try again." }
        generalMessages.push(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    const renderChatContent = () => {
      if (mode === ChatMode.Shopping) {
        return (
          <>
            <CardContent className="h-[300px] overflow-y-auto space-y-4">
              {shoppingMessages.map((m, index) => (
                <div key={index} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-lg p-2 ${m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 rounded-lg p-2">Thinking...</div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex flex-wrap gap-2 justify-center">
                {options.map((option, index) => (
                  <Button key={index} onClick={() => handleOptionClick(option)} disabled={isLoading}>
                    {option}
                  </Button>
                ))}
              </div>
            </CardFooter>
          </>
        )
      } else {
        return (
          <>
            <CardContent className="h-[300px] overflow-y-auto space-y-4">
              {generalMessages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-lg p-2 ${m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <form onSubmit={handleGeneralSubmit} className="flex w-full space-x-2">
                <Input value={input} onChange={handleInputChange} placeholder="Type your message..." />
                <Button type="submit">Send</Button>
              </form>
            </CardFooter>
          </>
        )
      }
    }

    return (
      <div className="fixed bottom-4 right-4">
        {isOpen ? (
          <Card className="w-80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Chatbot</CardTitle>
              <Button variant="ghost" size="icon" onClick={toggleChat}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <div className="px-4 py-2 space-x-2">
              <Button
                variant={mode === ChatMode.General ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(ChatMode.General)}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                General
              </Button>
              <Button
                variant={mode === ChatMode.Shopping ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode(ChatMode.Shopping)
                  setShoppingState({ step: "welcome", category: "", size: "", color: "" })
                  setShoppingMessages([])
                }}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Shopping
              </Button>
              <Button
                variant={mode === ChatMode.Contact ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(ChatMode.Contact)}
              >
                <Phone className="h-4 w-4 mr-2" />
                Contact
              </Button>
            </div>
            {mode === ChatMode.Contact ? (
              <CardContent>
                <h3 className="font-bold mb-2">Contact Information</h3>
                <p>Address: 123 E-commerce St, Web City, 12345</p>
                <p>Phone: (555) 123-4567</p>
                <p>Email: support@example.com</p>
              </CardContent>
            ) : (
              renderChatContent()
            )}
          </Card>
        ) : (
          <Button onClick={toggleChat} size="icon" className="rounded-full h-12 w-12">
            <MessageCircle className="h-6 w-6" />
          </Button>
        )}
      </div>
    )
  }

