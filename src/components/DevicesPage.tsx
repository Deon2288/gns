import React, { useState, useEffect } from 'react';
import { Table } from 'react-bootstrap';

const DevicesPage = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [sortKey, setSortKey] = useState('name');

    useEffect(() => {
        // Fetch devices from API or other source
        const fetchDevices = async () => {
            setLoading(true);
            const response = await fetch('/api/devices'); // Update with actual API
            const data = await response.json();
            setDevices(data);
            setLoading(false);
        };
        fetchDevices();
    }, []);

    const handleSort = (key) => {
        setSortKey(key);
    };

    const filteredDevices = devices.filter(device =>
        device.name.toLowerCase().includes(filter.toLowerCase())
    );

    const sortedDevices = filteredDevices.sort((a, b) =>
        a[sortKey].localeCompare(b[sortKey])
    );

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <input
                type="text"
                placeholder="Filter by name"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
            <Table striped bordered hover>
                <thead>
                    <tr>
                        <th onClick={() => handleSort('name')}>Name</th>
                        <th onClick={() => handleSort('type')}>Type</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedDevices.map(device => (
                        <tr key={device.id}>
                            <td>{device.name}</td>
                            <td>{device.type}</td>
                            <td><button>View Details</button></td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

export default DevicesPage;
