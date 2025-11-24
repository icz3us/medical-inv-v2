'use client'

import { useState, useEffect } from 'react'
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Debug: Log AI initialization status
if (typeof window !== 'undefined') {
  console.log('AI Integration Status:', {
    apiKeyPresent: !!GEMINI_API_KEY,
    aiInitialized: !!ai,
    apiKeyPreview: GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 5)}...` : 'Not set'
  });
}

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { inventoryService, requestService } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  Package, 
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

export default function PharmacistNurseDashboard() {
  const [items, setItems] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [requestForm, setRequestForm] = useState({
    quantity: '',
    department: '',
    reason: ''
  })
  
  // New state for AI features
  const [medicalCondition, setMedicalCondition] = useState('')
  const [procedureType, setProcedureType] = useState('')
  const [recommendedItems, setRecommendedItems] = useState([])
  const [usagePatterns, setUsagePatterns] = useState([])
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false)
  const [isGeneratingPatterns, setIsGeneratingPatterns] = useState(false)

  // Load data from database
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([loadItems(), loadMyRequests()])
  }

  const loadItems = async () => {
    const { data, error } = await inventoryService.getItems()
    if (error) {
      console.error('Error loading items:', error)
      setItems([])
    } else {
      setItems(data || [])
    }
  }

  const loadMyRequests = async () => {
    // Get current user ID from session
    const userData = sessionStorage.getItem('user')
    const currentUser = userData ? JSON.parse(userData) : null
    
    if (!currentUser) {
      setMyRequests([])
      return
    }

    const { data, error } = await requestService.getRequests()
    if (error) {
      console.error('Error loading requests:', error)
      setMyRequests([])
    } else {
      // Process the data to ensure it has the required fields
      const processedRequests = (data || []).map(request => {
        // If the data comes from Supabase with joins, extract the nested data
        if (request.inventory_items && typeof request.inventory_items === 'object') {
          request.item_name = request.inventory_items.name
        }
        
        // Ensure required fields exist
        return {
          id: request.id,
          item_id: request.item_id,
          item_name: request.item_name || `Item ${request.item_id}`,
          quantity_requested: request.quantity_requested,
          status: request.status,
          request_date: request.request_date,
          department: request.department || 'Unknown',
          reason: request.reason || 'No reason provided',
          ...request
        }
      })
      
      // Filter requests for current user
      const userRequests = processedRequests.filter(req => req.requester_id === currentUser.id)
      setMyRequests(userRequests)
    }
  }

  const handleRequestItem = (item) => {
    setSelectedItem(item)
    setRequestForm({
      quantity: '',
      department: '',
      reason: ''
    })
    setIsRequestDialogOpen(true)
  }

  const handleSubmitRequest = async () => {
    if (!requestForm.quantity || !requestForm.department || !requestForm.reason) return

    // Get current user ID from session
    const userData = sessionStorage.getItem('user')
    const currentUser = userData ? JSON.parse(userData) : null

    if (!currentUser) {
      alert('User session not found. Please log in again.')
      return
    }

    const newRequest = {
      id: `REQ${String(Date.now()).slice(-6)}`, // Generate unique ID
      item_id: selectedItem.id,
      requester_id: currentUser.id,
      quantity_requested: parseInt(requestForm.quantity),
      status: 'pending',
      request_date: new Date().toISOString(),
      department: requestForm.department,
      reason: requestForm.reason
    }

    try {
      const { data, error } = await requestService.addRequest(newRequest)
      
      if (error) {
        console.error('Error submitting request:', error)
        alert('Failed to submit request. Please try again.')
        return
      }

      // Add to local state with proper formatting for display
      const displayRequest = {
        id: newRequest.id,
        item_name: selectedItem.name,
        quantity_requested: newRequest.quantity_requested,
        status: newRequest.status,
        request_date: newRequest.request_date.split('T')[0],
        department: newRequest.department,
        reason: newRequest.reason
      }
      
      setMyRequests([displayRequest, ...myRequests])
      setIsRequestDialogOpen(false)
      setSelectedItem(null)
      setRequestForm({
        quantity: '',
        department: '',
        reason: ''
      })
      
      alert('Request submitted successfully!')
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request. Please try again.')
    }
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case 'medication': return 'bg-blue-100 text-blue-800'
      case 'equipment': return 'bg-green-100 text-green-800'
      case 'supplies': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRequestStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRequestStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />
      case 'approved': return <CheckCircle className="h-4 w-4" />
      case 'rejected': return <XCircle className="h-4 w-4" />
      default: return null
    }
  }

  const getStockStatus = (quantity, threshold) => {
    if (quantity < threshold) return { status: 'Low Stock', color: 'bg-red-100 text-red-800' }
    if (quantity < threshold * 1.5) return { status: 'Medium', color: 'bg-yellow-100 text-yellow-800' }
    return { status: 'Available', color: 'bg-green-100 text-green-800' }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pendingRequests = myRequests.filter(req => req.status === 'pending').length
  const approvedRequests = myRequests.filter(req => req.status === 'approved').length

  // AI-powered function to recommend supplies based on medical condition
  const getRecommendationsForCondition = async (condition) => {
    if (!condition.trim()) {
      console.log('No condition provided');
      return [];
    }
    
    if (!ai) {
      console.log('AI not initialized - check API key');
      alert('AI features require API key configuration');
      return [];
    }
    
    setIsGeneratingRecommendations(true);
    try {
      console.log('Generating recommendations for condition:', condition);
      const prompt = `As a medical inventory expert, recommend essential medical supplies for the following condition: "${condition}"
      
      Consider common treatments, medications, and equipment needed.
      
      Respond with a JSON array of item names only, like:
      ["item1", "item2", "item3"]
      
      Provide exactly 5 items that would be most relevant.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const responseText = response.text.trim();
      console.log('AI Response:', responseText);
      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (jsonMatch) {
        const itemsArray = JSON.parse(jsonMatch[0]);
        console.log('Parsed recommendations:', itemsArray);
        return itemsArray;
      }
      return [];
    } catch (error) {
      console.error("AI recommendations failed:", error);
      alert(`AI recommendation failed: ${error.message}`);
      return [];
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  // AI-powered function to predict supplies for procedures
  const getRecommendationsForProcedure = async (procedure) => {
    if (!procedure.trim()) {
      console.log('No procedure provided');
      return [];
    }
    
    if (!ai) {
      console.log('AI not initialized - check API key');
      alert('AI features require API key configuration');
      return [];
    }
    
    setIsGeneratingRecommendations(true);
    try {
      console.log('Generating recommendations for procedure:', procedure);
      const prompt = `As a medical inventory expert, recommend essential medical supplies for the following medical procedure: "${procedure}"
      
      Consider all equipment, medications, and disposables typically needed.
      
      Respond with a JSON array of item names only, like:
      ["item1", "item2", "item3"]
      
      Provide exactly 5 items that would be most relevant.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const responseText = response.text.trim();
      console.log('AI Response:', responseText);
      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (jsonMatch) {
        const itemsArray = JSON.parse(jsonMatch[0]);
        console.log('Parsed recommendations:', itemsArray);
        return itemsArray;
      }
      return [];
    } catch (error) {
      console.error("AI procedure recommendations failed:", error);
      alert(`AI procedure recommendation failed: ${error.message}`);
      return [];
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  // AI-powered function to analyze usage patterns
  const analyzeUsagePatterns = async (itemsList) => {
    if (!itemsList || itemsList.length === 0 || !ai) return [];
    
    setIsGeneratingPatterns(true);
    try {
      // Get item names and their request frequencies
      const itemNames = itemsList.map(item => item.name).join(", ");
      
      const prompt = `Analyze the following medical inventory items and identify common usage patterns for patient care:
      ${itemNames}
      
      Based on medical knowledge, group these items by:
      1. Common conditions they treat
      2. Typical procedures they support
      3. Frequency of use in healthcare settings
      
      Respond with a JSON array of objects, each containing:
      {
        "pattern": "brief description of the pattern",
        "items": ["item1", "item2", ...],
        "frequency": "high/medium/low"
      }
      
      Provide exactly 3 patterns.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const responseText = response.text.trim();
      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const patternsArray = JSON.parse(jsonMatch[0]);
        return patternsArray;
      }
      return [];
    } catch (error) {
      console.error("AI pattern analysis failed:", error);
      return [];
    } finally {
      setIsGeneratingPatterns(false);
    }
  };

  // Handle condition-based recommendations
  const handleConditionRecommendations = async () => {
    console.log('Handle condition recommendations called with:', medicalCondition);
    if (!medicalCondition.trim()) {
      alert('Please enter a medical condition');
      return;
    }
    
    const recommendations = await getRecommendationsForCondition(medicalCondition);
    console.log('Received recommendations:', recommendations);
    // Filter to only items that exist in our inventory
    const matchingItems = items.filter(item => 
      recommendations.some(rec => 
        item.name.toLowerCase().includes(rec.toLowerCase()) ||
        rec.toLowerCase().includes(item.name.toLowerCase())
      )
    );
    console.log('Matching items:', matchingItems);
    setRecommendedItems(matchingItems);
  };

  // Handle procedure-based recommendations
  const handleProcedureRecommendations = async () => {
    console.log('Handle procedure recommendations called with:', procedureType);
    if (!procedureType.trim()) {
      alert('Please enter a procedure type');
      return;
    }
    
    const recommendations = await getRecommendationsForProcedure(procedureType);
    console.log('Received recommendations:', recommendations);
    // Filter to only items that exist in our inventory
    const matchingItems = items.filter(item => 
      recommendations.some(rec => 
        item.name.toLowerCase().includes(rec.toLowerCase()) ||
        rec.toLowerCase().includes(item.name.toLowerCase())
      )
    );
    console.log('Matching items:', matchingItems);
    setRecommendedItems(matchingItems);
  };

  // Analyze usage patterns when items load
  useEffect(() => {
    if (items.length > 0 && usagePatterns.length === 0) {
      analyzeUsagePatterns(items).then(setUsagePatterns);
    }
  }, [items]);

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center justify-between lg:justify-start lg:space-x-4 w-full lg:w-auto">
            {/* Back to Role Selection Button */}
            <Link href="/" className="lg:flex-shrink-0">
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Role Selection</span>
              </Button>
            </Link>
            {/* Title Section - Centered on mobile, left on desktop */}
            <div className="text-center lg:text-left lg:flex-1 lg:ml-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Pharmacist / Nurse Dashboard</h1>
              <p className="text-slate-600 text-sm sm:text-lg">Request supplies and manage medical inventory for patient care</p>
            </div>
          </div>
          {/* Stats on right - hidden on mobile, shown on desktop */}
          <div className="hidden lg:flex items-center space-x-4 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm text-slate-500">My Pending Requests</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingRequests}</p>
            </div>
          </div>
        </div>
        {/* Mobile Stats */}
        <div className="lg:hidden mt-4 pt-4 border-t border-slate-200">
          <div className="text-center">
            <p className="text-sm text-slate-500">My Pending Requests</p>
            <p className="text-xl font-bold text-yellow-600">{pendingRequests}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">Total items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Requests</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedRequests}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Package className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {items.filter(item => item.quantity < item.min_threshold).length}
            </div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>
      </div>

      {/* My Requests */}
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-4 px-4 sm:px-6 pt-6">
          <CardTitle className="text-xl">My Requests</CardTitle>
          <CardDescription>
            Track your supply requests and their status
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6 pb-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Request ID</TableHead>
                  <TableHead className="px-4">Item</TableHead>
                  <TableHead className="px-4">Quantity</TableHead>
                  <TableHead className="px-4">Department</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium px-4">{request.id}</TableCell>
                    <TableCell className="px-4">{request.item_name}</TableCell>
                    <TableCell className="px-4">{request.quantity_requested}</TableCell>
                    <TableCell className="px-4">
                      <Badge variant="outline">{request.department}</Badge>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center space-x-2">
                        {getRequestStatusIcon(request.status)}
                        <Badge className={getRequestStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">{request.request_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Patient Care AI Features */}
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-4 px-4 sm:px-6 pt-6">
          <CardTitle className="text-xl">Patient Care Integration</CardTitle>
          <CardDescription>
            AI-powered recommendations for medical supplies based on conditions and procedures
          </CardDescription>
          {!ai && (
            <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm">
              AI features require API key configuration. Set NEXT_PUBLIC_GEMINI_KEY in your environment variables.
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Condition-based recommendations */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Recommend Supplies by Condition</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter medical condition (e.g., diabetes, hypertension)"
                  value={medicalCondition}
                  onChange={(e) => setMedicalCondition(e.target.value)}
                />
                <Button 
                  onClick={handleConditionRecommendations}
                  disabled={!medicalCondition.trim() || isGeneratingRecommendations}
                >
                  {isGeneratingRecommendations ? "Analyzing..." : "Recommend"}
                </Button>
              </div>
            </div>
            
            {/* Procedure-based recommendations */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Recommend Supplies by Procedure</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter procedure type (e.g., surgery, vaccination)"
                  value={procedureType}
                  onChange={(e) => setProcedureType(e.target.value)}
                />
                <Button 
                  onClick={handleProcedureRecommendations}
                  disabled={!procedureType.trim() || isGeneratingRecommendations}
                >
                  {isGeneratingRecommendations ? "Analyzing..." : "Recommend"}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Recommended Items */}
          {recommendedItems.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-lg mb-3">Recommended Items</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedItems.map((item) => {
                  const stockStatus = getStockStatus(item.quantity, item.min_threshold);
                  return (
                    <Card key={item.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                          <Badge className={stockStatus.color}>
                            {stockStatus.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-sm">Available: {item.quantity} {item.unit}</span>
                          <Button 
                            size="sm" 
                            onClick={() => handleRequestItem(item)}
                            disabled={item.quantity === 0}
                          >
                            Request
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Usage Patterns */}
          {usagePatterns.length > 0 && (
            <div className="mt-8">
              <h3 className="font-medium text-lg mb-3">Usage Patterns</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {usagePatterns.map((pattern, index) => (
                  <Card key={index} className="shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{pattern.pattern}</CardTitle>
                      <Badge variant={pattern.frequency === 'high' ? 'default' : pattern.frequency === 'medium' ? 'secondary' : 'outline'}>
                        {pattern.frequency} frequency
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1">
                        {pattern.items.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Search and Browse */}
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-4 px-4 sm:px-6 pt-6">
          <CardTitle className="text-xl">Available Inventory</CardTitle>
          <CardDescription>
            Search and request supplies from the available inventory
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search items by name, description, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead className="px-4">Name</TableHead>
                  <TableHead className="px-4">Category</TableHead>
                  <TableHead className="px-4">Available</TableHead>
                  <TableHead className="px-4">Unit</TableHead>
                  <TableHead className="px-4">Stock Status</TableHead>
                  <TableHead className="px-4">Expiry Date</TableHead>
                  <TableHead className="px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const stockStatus = getStockStatus(item.quantity, item.min_threshold)
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium px-4">{item.id}</TableCell>
                      <TableCell className="px-4">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge className={getCategoryColor(item.category)}>
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">{item.quantity}</TableCell>
                      <TableCell className="px-4">{item.unit}</TableCell>
                      <TableCell className="px-4">
                        <Badge className={stockStatus.color}>
                          {stockStatus.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">{item.expiry_date}</TableCell>
                      <TableCell className="px-4">
                        <Button
                          size="sm"
                          onClick={() => handleRequestItem(item)}
                          disabled={item.quantity === 0}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Request
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Item</DialogTitle>
            <DialogDescription>
              Submit a request for {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={requestForm.quantity}
                onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                placeholder="Enter quantity needed"
                max={selectedItem?.quantity}
              />
              <p className="text-xs text-muted-foreground">
                Available: {selectedItem?.quantity} {selectedItem?.unit}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={requestForm.department}
                onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })}
                placeholder="e.g., pharmacy, emergency, surgery"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Request</Label>
              <Input
                id="reason"
                value={requestForm.reason}
                onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                placeholder="Brief description of why you need this item"
              />
            </div>
            
            <Button onClick={handleSubmitRequest} className="w-full">
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}