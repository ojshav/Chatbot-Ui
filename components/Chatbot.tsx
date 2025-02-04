"use client"

import { useState, useEffect, useRef } from "react"
import { ShoppingBag, Phone, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useChat } from "ai/react"

interface Option {
  id: string
  name: string
}

enum ChatMode {
  General = 0,
  Shopping = 1,
  Contact = 2,
}

interface Message {
  role: "user" | "assistant"
  content: string
  isProduct?: boolean
}

export function Chatbot() {
  const { messages: aiMessages, handleSubmit: originalHandleSubmit } = useChat()
  const [mode, setMode] = useState<ChatMode>(ChatMode.General)
  const [shoppingMessages, setShoppingMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [shoppingState, setShoppingState] = useState<{
    step: "welcome" | "size" | "color" | "product"
    category?: Option
    size?: Option
    color?: Option
  }>({
    step: "welcome",
  })
  const [options, setOptions] = useState<Option[]>([])
  const [input, setInput] = useState("")
  const [generalMessages, setGeneralMessages] = useState<Message[]>([])

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode === ChatMode.Shopping && shoppingState.step === "welcome") {
      setShoppingMessages([
        {
          role: "assistant",
          content: "👋 Welcome to our shopping assistant! I'm excited to help you find exactly what you're looking for. Our store features a wide selection of premium products. What type of item interests you today?",
        },
      ])
      fetchOptions("get_categories")
    }
  }, [mode, shoppingState.step])

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      window.parent.postMessage(
        {
          type: "CHATBOT_RESIZE",
          width: width + 20,
          height: height + 20,
        },
        "*"
      )
    })

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Modify fetchOptions to store each option as an object with id and name.
  
  const fetchOptions = async (apiInput: string) => {
    setIsLoading(true)
    console.log("Fetching options with API input:", apiInput)
    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: "2", input: apiInput }),
      })
      if (response.ok) {
        const data = await response.json()
        console.log("Response data for", apiInput, ":", data)
        
        if (data.content && typeof data.content === "object") {
          const processedOptions: Option[] = Array.isArray(data.content)
            ? data.content.map((option: any) => ({
                id: option.id ? String(option.id) : String(option.name),
                name: option.name ? option.name : String(option),
              }))
            : Object.entries(data.content).map(([id, name]) => ({
                id: id,
                name: String(name),
              }))

          setOptions(processedOptions)
        }
      }
    } catch (error) {
      console.error("Error fetching options:", error)
      setOptions([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleOptionClick = async (option: Option) => {
    console.log("Option clicked:", option)
    const userMessage: Message = { role: "user", content: option.name }
    setShoppingMessages((prev) => [...prev, userMessage])

    if (option.name.toLowerCase() === "no") {
      setShoppingMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Thank you for shopping with us today! 🌟 It was a pleasure helping you. Have a wonderful day, and we hope to see you again soon! 👋",
        },
      ])
      setShoppingState({ step: "welcome" })
      setOptions([])
      return
    }

    if (option.name.toLowerCase() === "yes") {
      setShoppingMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Great! Let's find something else for you. What type of product are you interested in?",
        },
      ])
      setShoppingState({ step: "welcome" })
      fetchOptions("get_categories")
      return
    }  

    let nextStep: "size" | "color" | "product" | "welcome" = "welcome"
    let apiInput = ""

    switch (shoppingState.step) {
      case "welcome":
        nextStep = "size"
        apiInput = "get_sizes"
        setShoppingState((prev) => ({ ...prev, step: nextStep, category: option }))
        break
      case "size":
        nextStep = "color"
        apiInput = "get_colors"
        setShoppingState((prev) => ({ ...prev, step: nextStep, size: option }))
        break
      case "color":
        nextStep = "product"
        if (!shoppingState.category || !shoppingState.size) {
          console.error("Missing category or size selection")
          return
        }
        apiInput = `find_products ${shoppingState.category.id} ${shoppingState.size.id} ${option.id}`
        setShoppingState((prev) => ({ ...prev, step: nextStep, color: option }))
        break
      default:
        nextStep = "welcome"
        apiInput = "get_categories"
        setShoppingState({ step: "welcome" })
    }

    console.log("Sending API input:", apiInput)

    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: "2", input: apiInput }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Response data for", apiInput, ":", data)

        if (nextStep === "product") {
          const productList = Array.isArray(data.content)
            ? data.content.map((product: any) => ({
                name: product.name,
                recommendation: product.recommendation,
              }))
            : []

          const productMessages = productList.length
            ? [
                {
                  role: "assistant",
                  content: "📦 Here are some products that match your preferences:",
                },
                ...productList.map((product) => ({
                  role: "assistant",
                  content: `${product.name}\n${product.recommendation}`,
                  isProduct: true,
                })),
                {
                  role: "assistant",
                  content: "Would you like to look for something else?",
                },
              ]
            : [{ role: "assistant", content: "I apologize, but I couldn't find any products matching your criteria. Would you like to try a different combination? 😊" }]

          setShoppingMessages((prev) => [...prev, ...productMessages])
          setOptions([{ id: "yes", name: "Yes" }, { id: "no", name: "No" }])
        } else {
                let processedOptions: Option[] = []
          if (data.content && typeof data.content === "object") {
            processedOptions = Object.entries(data.content).map(([id, name]) => ({
              id: id,
              name: String(name),
            }))
          }
          setOptions(processedOptions)
        }
      }
    } catch (error) {
      console.error("Error fetching options:", error)
      setShoppingMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." }
      ])
      setOptions([])
    } finally {
      setIsLoading(false)
    }
  }

  const getNextStepPrompt = (step: string, category: string) => {
    switch (step) {
      case "size":
        return `Great! For ${category}, what size are you looking for?`
      case "color":
        return `Excellent choice! Now, what color would you prefer for the ${category}?`
      case "welcome":
        return "What type of product are you looking for today?"
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
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      }
      generalMessages.push(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const renderChatContent = () => {
    if (mode === ChatMode.Shopping) {
      return (
        <>
          <CardContent className="h-[300px] overflow-y-auto space-y-4">
            {shoppingMessages.map((m, index) => (
              <div
                key={index}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-lg p-2 ${
                    m.role === "user" 
                      ? "bg-blue-500 text-white" 
                      : m.isProduct 
                        ? "bg-white border-2 border-blue-300 shadow-md w-full" 
                        : "bg-gray-200"
                  }`}
                >
                  {m.isProduct ? (
                    <div className="space-y-2">
                      <div className="font-bold text-blue-600">{m.content.split('\n')[0]}</div>
                      <div className="text-gray-600">{m.content.split('\n')[1]}</div>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 rounded-lg p-2">Looking for the perfect match... 🔍</div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <div className="flex flex-wrap gap-2 justify-center">
              {options.length > 0 ? (
                options.map((option, index) => (
                  <Button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    disabled={isLoading}
                  >
                    {option.name}
                  </Button>
                ))
              ) : (
                !isLoading && <p className="text-gray-500">No options available</p>
              )}
            </div>
          </CardFooter>
        </>
      )
    } else {
          return (
        <>
          <CardContent className="h-[300px] overflow-y-auto space-y-4">
            {generalMessages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-lg p-2 ${
                    m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <form onSubmit={handleGeneralSubmit} className="flex w-full space-x-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
              />
              <Button type="submit">Send</Button>
            </form>
          </CardFooter>
        </>
      )
    }
  }

  return (
    <div ref={cardRef} className="fixed inset-0 flex items-center justify-center bg-transparent">
      <Card className="w-full h-full shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shopping Assistant</CardTitle>
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
              setShoppingState({ step: "welcome" })
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
            <p>Address: Scalixity E-commerce, Indore, Madhya Pradesh, India</p>
            <p>Phone: (555) 123-4567</p>
            <p>Email: support@scalixity.com</p>
          </CardContent>
        ) : (
          renderChatContent()
        )}
      </Card>
    </div>
  )
}